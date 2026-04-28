import { prisma } from "../models/prisma";
import { refundPaypalCapture } from "../util/paypal";
import { broadcast } from "./raffle-events";

const shuffle = <T,>(arr: T[]): T[] => {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const MAX_TICKET_NUMBER = 99999;

export const padTicket = (n: number) => {
  if (!Number.isFinite(n) || n < 0 || n > MAX_TICKET_NUMBER) {
    throw new Error(`padTicket: ticket number ${n} out of range (0..${MAX_TICKET_NUMBER}).`);
  }
  return Math.floor(n).toString().padStart(5, "0");
};

// ─── Phase parameters ───────────────────────────────────────────────────────
//
// Tunable timings for the three-phase elimination tournament. All in ms.
// Tuned for tight pacing: each phase should feel distinct and not drag.
// Phase 1 "bomb round" mechanic: every round we arm 10 random alive
// tickets with bombs (visible to all viewers), wait 5s for tension, then
// only 5 of those bombs actually go off. The other 5 just puff smoke
// and survive. Near the target threshold we still arm 10 bombs but cap
// the explosion count so we never overshoot 30 alive.
const PHASE1_INTERVAL_MS = 7_000; // round cycle = fuse + gap, used for ETA
const PHASE1_TARGET = 30;
const PHASE1_BOMBS_PER_ROUND = 10;
const PHASE1_EXPLOSIONS_PER_ROUND = 5;
const PHASE1_FUSE_MS = 5_000;
const PHASE1_GAP_MS = 2_000;
const PHASE2_TARGET = 10; // Reduce to 10 in phase 2
const PHASE2_WIND_INTERVAL_MS = 3_000;
const PHASE2_LIGHT_INTERVAL_MS = 6_000; // was 7s — flips faster for more tension
const PHASE2_WIND_BATCH = 5; // Tickets blown per gust
// 60s lobbies between phases — long enough for viewers to absorb who survived
// before the next round of mayhem starts. Used by both phase2_intro and
// phase3_intro.
const PHASE2_INTRO_MS = 60_000;
const PHASE3_INTRO_MS = 60_000;
const PHASE3_ADVANCE_INTERVAL_MS = 3_000;
const PHASE3_ELIMINATION_INTERVAL_MS = 12_000; // was 15s
// Final-stretch acceleration: when there are 3 or fewer horses left, the
// pace tightens dramatically so the finale doesn't drag.
const PHASE3_FINAL_THRESHOLD = 3;
const PHASE3_FINAL_ADVANCE_INTERVAL_MS = 4_000; // was 5s
const PHASE3_FINAL_ELIMINATION_INTERVAL_MS = 8_000; // was 10s

// Helpers exported so draw-state can mirror the same pacing math.
export const phase3AdvanceIntervalMs = (aliveCount: number): number =>
  aliveCount <= PHASE3_FINAL_THRESHOLD ? PHASE3_FINAL_ADVANCE_INTERVAL_MS : PHASE3_ADVANCE_INTERVAL_MS;
export const phase3EliminationIntervalMs = (aliveCount: number): number =>
  aliveCount <= PHASE3_FINAL_THRESHOLD ? PHASE3_FINAL_ELIMINATION_INTERVAL_MS : PHASE3_ELIMINATION_INTERVAL_MS;
export const phase2LightIntervalMs = (): number => PHASE2_LIGHT_INTERVAL_MS;
export const phase2WindIntervalMs = (): number => PHASE2_WIND_INTERVAL_MS;
export const phase1IntervalMs = (): number => PHASE1_INTERVAL_MS;

type SurvivorRow = {
  number: number;
  comment: string | null;
  user: { slug: string; username: string; imageUrl: string | null };
};

const buildWinnerEntries = (rows: SurvivorRow[]) =>
  rows.map((t) => ({
    ticketNumber: padTicket(t.number),
    userSlug: t.user.slug,
    userUsername: t.user.username,
    userImageUrl: t.user.imageUrl,
    comment: t.comment,
  }));

// ─── Timer registry (per raffle) ────────────────────────────────────────────
//
// Phases 1 and 3 each have ONE ticking timer at a time. Phase 2 has TWO
// running concurrently (wind + light). Cancel must clear all of them.
type TimerSlot = "main" | "wind" | "light" | "horseElim";
const pendingTimers = new Map<number, Map<TimerSlot, ReturnType<typeof setTimeout>>>();

const setTimer = (raffleId: number, slot: TimerSlot, t: ReturnType<typeof setTimeout>) => {
  let slots = pendingTimers.get(raffleId);
  if (!slots) {
    slots = new Map();
    pendingTimers.set(raffleId, slots);
  }
  const old = slots.get(slot);
  if (old) clearTimeout(old);
  slots.set(slot, t);
};

const clearTimer = (raffleId: number, slot: TimerSlot) => {
  const slots = pendingTimers.get(raffleId);
  if (!slots) return;
  const old = slots.get(slot);
  if (old) clearTimeout(old);
  slots.delete(slot);
};

const clearAllTimers = (raffleId: number) => {
  const slots = pendingTimers.get(raffleId);
  if (!slots) return;
  for (const t of slots.values()) clearTimeout(t);
  slots.clear();
  pendingTimers.delete(raffleId);
};

const hasActiveTimers = (raffleId: number): boolean => {
  const slots = pendingTimers.get(raffleId);
  return !!slots && slots.size > 0;
};

// ─── Atomic claim ───────────────────────────────────────────────────────────
const tryClaimDraw = async (raffleId: number): Promise<boolean> => {
  const result = await prisma.raffle.updateMany({
    where: { id: raffleId, status: "active" },
    data: {
      status: "drawing",
      lastEliminationAt: null,
      drawPhase: null,
      lightState: null,
      lastLightChangeAt: null,
      lastWindAt: null,
      phase3StartedAt: null,
      lastHorseAdvanceAt: null,
      lastHorseEliminationAt: null,
      revealStartedAt: null,
      revealOrder: null as any,
      revealDigits: null,
    },
  });
  return result.count === 1;
};

// ─── Status check helper ────────────────────────────────────────────────────
const isStillDrawing = async (raffleId: number): Promise<boolean> => {
  const r = await prisma.raffle.findUnique({
    where: { id: raffleId },
    select: { id: true, status: true },
  });
  return !!r && r.status === "drawing";
};

const aliveCount = async (raffleId: number): Promise<number> =>
  prisma.raffleTicket.count({ where: { raffleId, eliminatedAt: null } });

// ─── Public entry point ────────────────────────────────────────────────────
export async function executeDraw(raffleId: number): Promise<void> {
  const raffle = await prisma.raffle.findUnique({
    where: { id: raffleId },
    include: { tickets: true },
  });
  if (!raffle) throw new Error(`Raffle #${raffleId} not found.`);
  if (raffle.status !== "active") {
    console.log(`[raffle-draw] raffle #${raffleId} not active (status=${raffle.status}); skipping.`);
    return;
  }

  if (raffle.tickets.length < raffle.minTickets) {
    await executeCancel(raffleId, "No se alcanzó la cantidad mínima de tickets");
    return;
  }

  const winnersCount = Math.max(1, raffle.winnersCount ?? 1);

  // Short-circuit: not enough tickets to actually eliminate anyone.
  if (raffle.tickets.length <= winnersCount) {
    const survivors = await prisma.raffleTicket.findMany({
      where: { raffleId },
      orderBy: { number: "asc" },
      include: { user: { select: { slug: true, username: true, imageUrl: true } } },
    });
    const lowest = survivors[0];
    const finalised = await prisma.raffle.updateMany({
      where: { id: raffleId, status: "active" },
      data: {
        status: "completed",
        winnerTicketId: lowest?.id ?? null,
        winnerUserId: lowest?.userId ?? null,
        completedAt: new Date(),
      },
    });
    if (finalised.count !== 1) return;
    broadcast(raffleId, { type: "draw_completed", winners: buildWinnerEntries(survivors) });
    return;
  }

  const claimed = await tryClaimDraw(raffleId);
  if (!claimed) {
    console.log(`[raffle-draw] raffle #${raffleId} status race lost; skipping.`);
    return;
  }

  broadcast(raffleId, {
    type: "draw_started",
    totalTickets: raffle.tickets.length,
    winnersCount,
    eliminationIntervalMs: PHASE1_INTERVAL_MS,
    startedAt: new Date().toISOString(),
  });

  // Pick the entry phase based on alive count. winnersCount is fixed at 1
  // for the three-phase animation — multi-winner raffles fall back to phase 1
  // semantics until the target is reached, then jump straight to phase 3
  // intro (where the "horse race" surfaces the top winnersCount).
  const total = raffle.tickets.length;
  if (total > 50) {
    await enterPhase1(raffleId);
  } else if (total > PHASE2_TARGET) {
    await enterPhase2(raffleId);
  } else {
    await enterPhase3Intro(raffleId);
  }
}

// ─── Phase 1: classic 5s eliminations until target ──────────────────────────
async function enterPhase1(raffleId: number): Promise<void> {
  await prisma.raffle.update({
    where: { id: raffleId },
    data: { drawPhase: "phase1", lastEliminationAt: null },
  });
  broadcast(raffleId, { type: "phase_started", phase: "phase1" });
  schedulePhase1Round(raffleId);
}

// Phase 1 round: arm bombs on 10 random tickets, broadcast, schedule the
// explosion 5s later. The explosion handler decides which subset goes off.
function schedulePhase1Round(raffleId: number): void {
  const t = setTimeout(async () => {
    clearTimer(raffleId, "main");
    try {
      if (!(await isStillDrawing(raffleId))) return;
      const alive = await prisma.raffleTicket.findMany({
        where: { raffleId, eliminatedAt: null },
        select: { id: true, number: true },
      });
      if (alive.length <= PHASE1_TARGET) {
        await enterPhase2Intro(raffleId);
        return;
      }

      // Cap explosions so we don't overshoot the 30-alive target — close to
      // the boundary the round still places 10 bombs but only enough go off
      // to land exactly on 30. Smoke (non-fatal bombs) covers the rest.
      const maxToEliminate = alive.length - PHASE1_TARGET;
      const toExplode = Math.max(1, Math.min(PHASE1_EXPLOSIONS_PER_ROUND, maxToEliminate));
      const bombsThisRound = Math.min(PHASE1_BOMBS_PER_ROUND, alive.length);

      const bombCandidates = shuffle(alive).slice(0, bombsThisRound);
      const bombIds = bombCandidates.map((t) => t.id);
      // Pick which subset will actually explode (others puff smoke).
      const explodeIds = shuffle(bombCandidates).slice(0, toExplode).map((t) => t.id);

      const now = new Date();
      await prisma.raffle.update({
        where: { id: raffleId },
        data: {
          phase1BombTicketIds: bombIds as any,
          phase1ExplodeTicketIds: explodeIds as any,
          phase1BombsPlacedAt: now,
        },
      });
      broadcast(raffleId, {
        type: "phase1_bombs_placed",
        bombTicketIds: bombIds,
        explodeCount: toExplode,
        fuseMs: PHASE1_FUSE_MS,
      });

      // Schedule the explosion at the end of the fuse.
      const explodeTimer = setTimeout(() => explodePhase1Round(raffleId), PHASE1_FUSE_MS);
      setTimer(raffleId, "main", explodeTimer);
    } catch (err) {
      console.error(`[raffle-draw] phase1 round failed for raffle #${raffleId}:`, err);
    }
  }, PHASE1_GAP_MS);
  setTimer(raffleId, "main", t);
}

// Phase 1 explosion: commits the eliminations for the previously-armed
// round, broadcasts what blew up vs what just smoked, then queues the
// next round.
async function explodePhase1Round(raffleId: number): Promise<void> {
  clearTimer(raffleId, "main");
  try {
    if (!(await isStillDrawing(raffleId))) return;
    const r = await prisma.raffle.findUnique({
      where: { id: raffleId },
      select: {
        drawPhase: true,
        phase1BombTicketIds: true,
        phase1ExplodeTicketIds: true,
      },
    });
    if (!r || r.drawPhase !== "phase1") return;
    const bombIds = (r.phase1BombTicketIds as number[] | null) ?? [];
    const explodeIds = (r.phase1ExplodeTicketIds as number[] | null) ?? [];
    if (bombIds.length === 0 || explodeIds.length === 0) {
      // No round in flight — start one.
      schedulePhase1Round(raffleId);
      return;
    }
    const smokeIds = bombIds.filter((id) => !explodeIds.includes(id));

    const now = new Date();
    const startOrder = (await prisma.raffleTicket.count({
      where: { raffleId, eliminatedAt: { not: null } },
    })) + 1;
    for (let i = 0; i < explodeIds.length; i++) {
      await prisma.raffleTicket.update({
        where: { id: explodeIds[i] },
        data: { eliminatedAt: now, eliminationOrder: startOrder + i },
      });
    }
    await prisma.raffle.update({
      where: { id: raffleId },
      data: {
        phase1BombTicketIds: null as any,
        phase1ExplodeTicketIds: null as any,
        phase1BombsPlacedAt: null,
        lastEliminationAt: now,
      },
    });
    broadcast(raffleId, {
      type: "phase1_bombs_exploded",
      explodedTicketIds: explodeIds,
      smokeTicketIds: smokeIds,
    });

    // Check if we hit the target, otherwise queue the next round.
    const aliveAfter = await aliveCount(raffleId);
    if (aliveAfter <= PHASE1_TARGET) {
      await enterPhase2Intro(raffleId);
      return;
    }
    schedulePhase1Round(raffleId);
  } catch (err) {
    console.error(`[raffle-draw] phase1 explosion failed for raffle #${raffleId}:`, err);
  }
}

// ─── Phase 2 intro: 60s lobby ───────────────────────────────────────────────
async function enterPhase2Intro(raffleId: number): Promise<void> {
  await prisma.raffle.update({
    where: { id: raffleId },
    data: {
      drawPhase: "phase2_intro",
      // Reuse phase3StartedAt as the "next phase starts at" anchor — the FE
      // already knows how to read this for the intro countdown. (Phase 3
      // overwrites it later with its own start time.)
      phase3StartedAt: new Date(Date.now() + PHASE2_INTRO_MS),
    },
  });
  broadcast(raffleId, { type: "phase_started", phase: "phase2_intro" });

  const t = setTimeout(async () => {
    clearTimer(raffleId, "main");
    try {
      if (!(await isStillDrawing(raffleId))) return;
      await enterPhase2(raffleId);
    } catch (err) {
      console.error(`[raffle-draw] phase2 intro failed for raffle #${raffleId}:`, err);
    }
  }, PHASE2_INTRO_MS);
  setTimer(raffleId, "main", t);
}

// ─── Phase 2: Squid-Game wind + lights until 10 remain ──────────────────────
async function enterPhase2(raffleId: number): Promise<void> {
  const now = new Date();
  await prisma.raffle.update({
    where: { id: raffleId },
    data: {
      drawPhase: "phase2",
      lightState: "green",
      lastLightChangeAt: now,
      lastWindAt: null,
    },
  });
  broadcast(raffleId, { type: "phase_started", phase: "phase2" });
  // Bootstrap the two parallel timers.
  schedulePhase2Wind(raffleId);
  schedulePhase2Light(raffleId);
}

function schedulePhase2Wind(raffleId: number): void {
  const t = setTimeout(async () => {
    clearTimer(raffleId, "wind");
    try {
      if (!(await isStillDrawing(raffleId))) return;
      const r = await prisma.raffle.findUnique({
        where: { id: raffleId },
        select: { drawPhase: true, lightState: true },
      });
      if (!r || r.drawPhase !== "phase2") return;

      const aliveTickets = await prisma.raffleTicket.findMany({
        where: { raffleId, eliminatedAt: null },
        select: { id: true, number: true },
      });
      if (aliveTickets.length <= PHASE2_TARGET) {
        clearTimer(raffleId, "light");
        await enterPhase3Intro(raffleId);
        return;
      }

      // Cap the batch so a red-light gust can't overshoot the target.
      const maxEliminable = Math.max(0, aliveTickets.length - PHASE2_TARGET);
      const batchSize = r.lightState === "red"
        ? Math.min(PHASE2_WIND_BATCH, maxEliminable)
        : Math.min(PHASE2_WIND_BATCH, aliveTickets.length);

      const blown = shuffle(aliveTickets).slice(0, batchSize);
      const blownIds = blown.map((t) => t.id);
      const now = new Date();

      let eliminatedIds: number[] = [];
      if (r.lightState === "red" && batchSize > 0) {
        // Eliminate the blown tickets.
        const startOrder = (await prisma.raffleTicket.count({
          where: { raffleId, eliminatedAt: { not: null } },
        })) + 1;
        for (let i = 0; i < blown.length; i++) {
          await prisma.raffleTicket.update({
            where: { id: blown[i].id },
            data: { eliminatedAt: now, eliminationOrder: startOrder + i, blownAt: now },
          });
        }
        eliminatedIds = blownIds;
        await prisma.raffle.update({
          where: { id: raffleId },
          data: { lastEliminationAt: now, lastWindAt: now },
        });
      } else {
        // Green light: just stamp blownAt for the FE animation.
        await prisma.raffleTicket.updateMany({
          where: { id: { in: blownIds } },
          data: { blownAt: now },
        });
        await prisma.raffle.update({
          where: { id: raffleId },
          data: { lastWindAt: now },
        });
      }

      broadcast(raffleId, {
        type: "wind_gust",
        ticketIds: blownIds,
        lightState: (r.lightState as "red" | "green") ?? "green",
        eliminatedTicketIds: eliminatedIds,
      });

      // Check threshold AFTER applying the gust.
      const aliveAfter = aliveTickets.length - eliminatedIds.length;
      if (aliveAfter <= PHASE2_TARGET) {
        clearTimer(raffleId, "light");
        await enterPhase3Intro(raffleId);
        return;
      }

      schedulePhase2Wind(raffleId);
    } catch (err) {
      console.error(`[raffle-draw] phase2 wind failed for raffle #${raffleId}:`, err);
    }
  }, PHASE2_WIND_INTERVAL_MS);
  setTimer(raffleId, "wind", t);
}

function schedulePhase2Light(raffleId: number): void {
  const t = setTimeout(async () => {
    clearTimer(raffleId, "light");
    try {
      if (!(await isStillDrawing(raffleId))) return;
      const r = await prisma.raffle.findUnique({
        where: { id: raffleId },
        select: { drawPhase: true, lightState: true },
      });
      if (!r || r.drawPhase !== "phase2") return;
      const next = r.lightState === "red" ? "green" : "red";
      await prisma.raffle.update({
        where: { id: raffleId },
        data: { lightState: next, lastLightChangeAt: new Date() },
      });
      broadcast(raffleId, { type: "light_change", lightState: next });
      schedulePhase2Light(raffleId);
    } catch (err) {
      console.error(`[raffle-draw] phase2 light failed for raffle #${raffleId}:`, err);
    }
  }, PHASE2_LIGHT_INTERVAL_MS);
  setTimer(raffleId, "light", t);
}

// ─── Phase 3 intro (30s lobby) → Phase 3 (horse race) ───────────────────────
async function enterPhase3Intro(raffleId: number): Promise<void> {
  // Reset all alive tickets' horseSteps so a freshly-entered phase 3 starts
  // from zero (e.g., when this is invoked from resume after a crash).
  await prisma.raffleTicket.updateMany({
    where: { raffleId, eliminatedAt: null },
    data: { horseSteps: 0 },
  });
  await prisma.raffle.update({
    where: { id: raffleId },
    data: {
      drawPhase: "phase3_intro",
      phase3StartedAt: new Date(Date.now() + PHASE3_INTRO_MS),
      lightState: null,
      lastWindAt: null,
      lastLightChangeAt: null,
    },
  });
  broadcast(raffleId, { type: "phase_started", phase: "phase3_intro" });

  const t = setTimeout(async () => {
    clearTimer(raffleId, "main");
    try {
      if (!(await isStillDrawing(raffleId))) return;
      await enterPhase3(raffleId);
    } catch (err) {
      console.error(`[raffle-draw] phase3 intro failed for raffle #${raffleId}:`, err);
    }
  }, PHASE3_INTRO_MS);
  setTimer(raffleId, "main", t);
}

async function enterPhase3(raffleId: number): Promise<void> {
  const now = new Date();
  await prisma.raffle.update({
    where: { id: raffleId },
    data: {
      drawPhase: "phase3",
      phase3StartedAt: now,
      lastHorseAdvanceAt: null,
      lastHorseEliminationAt: now,
    },
  });
  broadcast(raffleId, { type: "phase_started", phase: "phase3" });
  schedulePhase3Advance(raffleId);
  schedulePhase3Elimination(raffleId);
}

function schedulePhase3Advance(raffleId: number, intervalMs: number = PHASE3_ADVANCE_INTERVAL_MS): void {
  const t = setTimeout(async () => {
    clearTimer(raffleId, "main");
    try {
      if (!(await isStillDrawing(raffleId))) return;
      const r = await prisma.raffle.findUnique({
        where: { id: raffleId },
        select: { drawPhase: true },
      });
      if (!r || r.drawPhase !== "phase3") return;

      const alive = await prisma.raffleTicket.findMany({
        where: { raffleId, eliminatedAt: null },
        select: { id: true, horseSteps: true },
      });
      if (alive.length <= 1) {
        clearTimer(raffleId, "horseElim");
        await finalisePhase3(raffleId);
        return;
      }
      // Re-pick interval based on current alive count for the NEXT tick
      // (dramatic finale acceleration once we hit the threshold).
      intervalMs = phase3AdvanceIntervalMs(alive.length);

      const updates: { ticketId: number; horseSteps: number }[] = [];
      for (const t of alive) {
        const advance = 1 + Math.floor(Math.random() * 3); // 1..3
        const newSteps = t.horseSteps + advance;
        await prisma.raffleTicket.update({
          where: { id: t.id },
          data: { horseSteps: newSteps },
        });
        updates.push({ ticketId: t.id, horseSteps: newSteps });
      }
      await prisma.raffle.update({
        where: { id: raffleId },
        data: { lastHorseAdvanceAt: new Date() },
      });
      broadcast(raffleId, { type: "horse_advance", steps: updates });
      schedulePhase3Advance(raffleId, intervalMs);
    } catch (err) {
      console.error(`[raffle-draw] phase3 advance failed for raffle #${raffleId}:`, err);
    }
  }, intervalMs);
  setTimer(raffleId, "main", t);
}

function schedulePhase3Elimination(raffleId: number, intervalMs: number = PHASE3_ELIMINATION_INTERVAL_MS): void {
  const t = setTimeout(async () => {
    clearTimer(raffleId, "horseElim");
    try {
      if (!(await isStillDrawing(raffleId))) return;
      const r = await prisma.raffle.findUnique({
        where: { id: raffleId },
        select: { drawPhase: true },
      });
      if (!r || r.drawPhase !== "phase3") return;

      const alive = await prisma.raffleTicket.findMany({
        where: { raffleId, eliminatedAt: null },
        orderBy: [{ horseSteps: "asc" }, { number: "asc" }], // tie-break by ticket number
        include: { user: { select: { slug: true, username: true, imageUrl: true } } },
      });
      if (alive.length <= 1) {
        clearTimer(raffleId, "main");
        await finalisePhase3(raffleId);
        return;
      }
      const last = alive[0];
      const eliminationOrder = (await prisma.raffleTicket.count({
        where: { raffleId, eliminatedAt: { not: null } },
      })) + 1;
      const now = new Date();
      await prisma.raffleTicket.update({
        where: { id: last.id },
        data: { eliminatedAt: now, eliminationOrder },
      });
      await prisma.raffle.update({
        where: { id: raffleId },
        data: { lastHorseEliminationAt: now, lastEliminationAt: now },
      });
      broadcast(raffleId, {
        type: "horse_elimination",
        ticketId: last.id,
        ticketNumber: padTicket(last.number),
        userSlug: last.user.slug,
        userUsername: last.user.username,
        userImageUrl: last.user.imageUrl,
      });

      if (alive.length - 1 <= 1) {
        clearTimer(raffleId, "main");
        await finalisePhase3(raffleId);
        return;
      }
      // Pick the next-tick interval based on alive count post-elimination so
      // the dramatic finale acceleration kicks in at the threshold.
      const nextInterval = phase3EliminationIntervalMs(alive.length - 1);
      schedulePhase3Elimination(raffleId, nextInterval);
    } catch (err) {
      console.error(`[raffle-draw] phase3 elimination failed for raffle #${raffleId}:`, err);
    }
  }, intervalMs);
  setTimer(raffleId, "horseElim", t);
}

async function finalisePhase3(raffleId: number): Promise<void> {
  clearAllTimers(raffleId);
  try {
    const survivors = await prisma.raffleTicket.findMany({
      where: { raffleId, eliminatedAt: null },
      orderBy: { number: "asc" },
      include: { user: { select: { slug: true, username: true, imageUrl: true } } },
    });
    const lowest = survivors[0];
    const finalised = await prisma.raffle.updateMany({
      where: { id: raffleId, status: "drawing" },
      data: {
        status: "completed",
        winnerTicketId: lowest?.id ?? null,
        winnerUserId: lowest?.userId ?? null,
        drawPhase: null,
        completedAt: new Date(),
      },
    });
    if (finalised.count !== 1) return;
    broadcast(raffleId, { type: "draw_completed", winners: buildWinnerEntries(survivors) });
  } catch (err) {
    console.error(`[raffle-draw] finalisePhase3 failed for raffle #${raffleId}:`, err);
  }
}

// ─── Cancel ────────────────────────────────────────────────────────────────
export async function executeCancel(raffleId: number, reason: string): Promise<void> {
  clearAllTimers(raffleId);

  const raffle = await prisma.raffle.findUnique({
    where: { id: raffleId },
    include: { tickets: { include: { refund: true } } },
  });
  if (!raffle) throw new Error(`Raffle #${raffleId} not found.`);
  if (raffle.status === "completed" || raffle.status === "cancelled") return;

  const cancelled = await prisma.raffle.updateMany({
    where: { id: raffleId, status: { in: ["active", "drawing"] } },
    data: { status: "cancelled", cancelReason: reason, drawPhase: null },
  });
  if (cancelled.count !== 1) return;

  for (const ticket of raffle.tickets) {
    if (ticket.refund) continue;
    if (ticket.paypalCaptureId && ticket.amountPaid > 0) {
      let status: "completed" | "failed" = "completed";
      let failureReason: string | null = null;
      let paypalRefundId: string | null = null;
      try {
        const refundResult: any = await refundPaypalCapture(ticket.paypalCaptureId, {
          value: ticket.amountPaid.toFixed(2),
          currency_code: raffle.currency,
        });
        paypalRefundId = refundResult?.id ?? null;
      } catch (err: any) {
        status = "failed";
        failureReason = err?.message?.slice(0, 256) ?? "PayPal refund failed";
        console.error(`[raffle-draw] Refund failed for ticket #${ticket.id}:`, err);
      }
      await prisma.raffleRefund.create({
        data: {
          raffleId: raffle.id,
          raffleTicketId: ticket.id,
          userId: ticket.userId,
          amount: ticket.amountPaid,
          currency: raffle.currency,
          paypalRefundId,
          status,
          failureReason,
        },
      });
      await prisma.raffleTicket.update({
        where: { id: ticket.id },
        data: { refundedAt: new Date() },
      });
    } else if (ticket.paypalCaptureId && ticket.amountPaid <= 0) {
      console.warn(`[raffle-draw] ticket #${ticket.id} has paypalCaptureId but amountPaid=${ticket.amountPaid}; skipping refund call.`);
      await prisma.raffleTicket.update({
        where: { id: ticket.id },
        data: { refundedAt: new Date() },
      });
    } else {
      await prisma.raffleTicket.update({
        where: { id: ticket.id },
        data: { refundedAt: new Date() },
      });
    }
  }

  broadcast(raffleId, { type: "cancelled", reason });
}

// ─── Recovery for crashes ──────────────────────────────────────────────────
//
// Called from the cron each minute. Re-enters the appropriate phase if the
// process restarted and lost its in-memory timers.
export async function resumeStuckDraws(): Promise<void> {
  try {
    const drawing = await prisma.raffle.findMany({
      where: { status: "drawing", deletedAt: null },
    });
    if (drawing.length === 0) return;

    for (const raffle of drawing) {
      if (hasActiveTimers(raffle.id)) continue; // Alive in this process.

      const intervalMs = Math.max(0, raffle.eliminationIntervalMs ?? PHASE1_INTERVAL_MS);
      const stalenessThreshold = Math.max(30_000, intervalMs * 3);
      const refTime = raffle.lastEliminationAt?.getTime()
        ?? raffle.lastWindAt?.getTime()
        ?? raffle.lastHorseAdvanceAt?.getTime()
        ?? raffle.phase3StartedAt?.getTime()
        ?? raffle.updatedAt?.getTime()
        ?? 0;
      if (Date.now() - refTime < stalenessThreshold) continue;

      console.warn(`[raffle-draw] resuming stuck draw for raffle #${raffle.id} (phase=${raffle.drawPhase})`);

      const alive = await aliveCount(raffle.id);
      if (alive <= 1) {
        await finalisePhase3(raffle.id);
        continue;
      }

      // Clear any stale phase-1 bomb state — the old round's timers are
      // dead so we don't want viewers stuck staring at frozen ticking
      // bombs that will never explode. A fresh round kicks off below.
      if (raffle.phase1BombsPlacedAt) {
        await prisma.raffle.update({
          where: { id: raffle.id },
          data: {
            phase1BombTicketIds: null as any,
            phase1ExplodeTicketIds: null as any,
            phase1BombsPlacedAt: null,
          },
        });
      }

      // Re-enter the appropriate phase. Picks the same threshold rules as
      // executeDraw so a crash in phase 1 with 25 alive tickets resumes in
      // the right place.
      if (alive > 50) {
        await enterPhase1(raffle.id);
      } else if (alive > PHASE2_TARGET) {
        // Crashed in phase 1 → phase 2 transition: skip the intro
        // since we don't know when it would have ended; jump to phase 2.
        await enterPhase2(raffle.id);
      } else {
        await enterPhase3Intro(raffle.id);
      }
    }
  } catch (err) {
    console.error("[raffle-draw] resumeStuckDraws failed:", err);
  }
}
