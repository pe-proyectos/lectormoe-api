import { prisma } from "../../models/prisma";
import {
  padTicket,
  phase1IntervalMs,
  phase2WindIntervalMs,
  phase2LightIntervalMs,
  phase3AdvanceIntervalMs,
  phase3EliminationIntervalMs,
} from "../../services/raffle-draw";

// Mirrors the constants in raffle-draw.ts via the helper exports — keeps
// the FE countdowns aligned with the service's actual scheduling. Phase 3
// helpers take alive count so we can reflect the finale acceleration.
const PHASE1_TARGET = 30;
const PHASE2_TARGET = 10;

export const getRaffleDrawState = async (slug: string) => {
  const raffle = await prisma.raffle.findUnique({
    where: { slug },
    select: {
      id: true,
      status: true,
      winnersCount: true,
      eliminationIntervalMs: true,
      lastEliminationAt: true,
      drawPhase: true,
      lightState: true,
      lastLightChangeAt: true,
      lastWindAt: true,
      phase3StartedAt: true,
      lastHorseAdvanceAt: true,
      lastHorseEliminationAt: true,
      deletedAt: true,
    },
  });
  if (!raffle || raffle.deletedAt) return null;

  const [totalTickets, eliminatedCount, aliveTickets, recentEliminatedRows, winnersRows] = await Promise.all([
    prisma.raffleTicket.count({ where: { raffleId: raffle.id } }),
    prisma.raffleTicket.count({ where: { raffleId: raffle.id, eliminatedAt: { not: null } } }),
    prisma.raffleTicket.findMany({
      where: { raffleId: raffle.id, eliminatedAt: null },
      orderBy: { number: "asc" },
      include: { user: { select: { slug: true, username: true, imageUrl: true } } },
    }),
    // Last 10 eliminated tickets, newest first. Used for the "ya cayeron"
    // strip so the user can see who got knocked out across all phases.
    prisma.raffleTicket.findMany({
      where: { raffleId: raffle.id, eliminatedAt: { not: null } },
      orderBy: { eliminationOrder: "desc" },
      take: 10,
      include: { user: { select: { slug: true, username: true, imageUrl: true } } },
    }),
    raffle.status === "completed"
      ? prisma.raffleTicket.findMany({
          where: { raffleId: raffle.id, eliminatedAt: null },
          orderBy: { number: "asc" },
          include: { user: { select: { slug: true, username: true, imageUrl: true } } },
        })
      : Promise.resolve(null),
  ]);

  const remainingCount = totalTickets - eliminatedCount;
  const eliminationsRemaining = Math.max(0, remainingCount - raffle.winnersCount);

  // ─── Phase progress / ETAs ──────────────────────────────────────────────
  // How many eliminations until the NEXT phase boundary. Used for "Quedan
  // X para fase 2" labels in the UI.
  let eliminationsUntilNextPhase: number | null = null;
  if (raffle.drawPhase === "phase1") {
    eliminationsUntilNextPhase = Math.max(0, remainingCount - PHASE1_TARGET);
  } else if (raffle.drawPhase === "phase2") {
    eliminationsUntilNextPhase = Math.max(0, remainingCount - PHASE2_TARGET);
  } else if (raffle.drawPhase === "phase3") {
    eliminationsUntilNextPhase = Math.max(0, remainingCount - raffle.winnersCount);
  }

  // Coarse ETA when phase 1 / phase 3 ends. Phase 2 is non-deterministic
  // (depends on light state cycle) so we skip it.
  let phaseEndsApproxAt: string | null = null;
  if (raffle.drawPhase === "phase1") {
    const ms = Math.max(0, remainingCount - PHASE1_TARGET) * phase1IntervalMs();
    phaseEndsApproxAt = new Date(Date.now() + ms).toISOString();
  } else if (raffle.drawPhase === "phase3") {
    // Account for the finale acceleration (≤3 alive uses 10s, otherwise 15s).
    let ms = 0;
    let alive = remainingCount;
    while (alive > raffle.winnersCount) {
      ms += phase3EliminationIntervalMs(alive);
      alive--;
    }
    phaseEndsApproxAt = new Date(Date.now() + ms).toISOString();
  }

  // Phase 1 — classic single-elimination interval.
  const nextEliminationAt =
    raffle.drawPhase === "phase1" && raffle.lastEliminationAt
      ? new Date(raffle.lastEliminationAt.getTime() + raffle.eliminationIntervalMs).toISOString()
      : null;

  // Phase 2 — wind + light timers.
  const nextWindAt =
    raffle.drawPhase === "phase2" && raffle.lastWindAt
      ? new Date(raffle.lastWindAt.getTime() + phase2WindIntervalMs()).toISOString()
      : raffle.drawPhase === "phase2"
      ? new Date(Date.now() + phase2WindIntervalMs()).toISOString()
      : null;
  const nextLightChangeAt =
    raffle.drawPhase === "phase2" && raffle.lastLightChangeAt
      ? new Date(raffle.lastLightChangeAt.getTime() + phase2LightIntervalMs()).toISOString()
      : null;

  // Phase intro lobby end: shared by phase2_intro AND phase3_intro. The
  // raffle row stores the "next phase starts at" timestamp in phase3StartedAt
  // for both lobbies (no separate column). When the actual phase 3 begins,
  // the column is overwritten with the real start time.
  const phaseIntroEndsAt =
    (raffle.drawPhase === "phase2_intro" || raffle.drawPhase === "phase3_intro") && raffle.phase3StartedAt
      ? raffle.phase3StartedAt.toISOString()
      : null;
  // Legacy alias kept for backwards compat with older FE bundles.
  const phase3StartsAt = raffle.drawPhase === "phase3_intro" ? phaseIntroEndsAt : null;
  // Actual phase 3 start timestamp — exposed always (when set) so the FE
  // can filter phase-3 finalists from the full ticket roster (a ticket
  // belongs to phase 3 iff !eliminatedAt OR eliminatedAt >= phase3StartedAt).
  const phase3StartedAt =
    raffle.drawPhase === "phase3" && raffle.phase3StartedAt
      ? raffle.phase3StartedAt.toISOString()
      : null;
  const advanceMs = phase3AdvanceIntervalMs(remainingCount);
  const eliminationMs = phase3EliminationIntervalMs(remainingCount);
  const nextHorseAdvanceAt =
    raffle.drawPhase === "phase3" && raffle.lastHorseAdvanceAt
      ? new Date(raffle.lastHorseAdvanceAt.getTime() + advanceMs).toISOString()
      : raffle.drawPhase === "phase3"
      ? new Date(Date.now() + advanceMs).toISOString()
      : null;
  const nextHorseEliminationAt =
    raffle.drawPhase === "phase3" && raffle.lastHorseEliminationAt
      ? new Date(raffle.lastHorseEliminationAt.getTime() + eliminationMs).toISOString()
      : null;

  const aliveRoster = aliveTickets.map((t) => ({
    id: t.id,
    number: padTicket(t.number),
    rawNumber: t.number,
    userSlug: t.user.slug,
    userUsername: t.user.username,
    userImageUrl: t.user.imageUrl,
    horseSteps: t.horseSteps,
    blownAt: t.blownAt ? t.blownAt.toISOString() : null,
  }));

  const recentEliminated = recentEliminatedRows.map((t) => ({
    id: t.id,
    number: padTicket(t.number),
    rawNumber: t.number,
    userSlug: t.user.slug,
    userUsername: t.user.username,
    userImageUrl: t.user.imageUrl,
    eliminationOrder: t.eliminationOrder ?? 0,
  }));

  // Phase 3 last-place ticket (for the "Próxima eliminación: 15s #00023" badge).
  let lastPlace: typeof aliveRoster[number] | null = null;
  if (raffle.drawPhase === "phase3" && aliveRoster.length > 1) {
    lastPlace = [...aliveRoster].sort((a, b) =>
      a.horseSteps - b.horseSteps || a.rawNumber - b.rawNumber,
    )[0] ?? null;
  }

  const winners = winnersRows
    ? winnersRows.map((t) => ({
        number: padTicket(t.number),
        userSlug: t.user.slug,
        userUsername: t.user.username,
        userImageUrl: t.user.imageUrl,
        comment: t.comment,
      }))
    : null;

  return {
    status: raffle.status,
    phase: raffle.drawPhase,
    totalTickets,
    eliminatedCount,
    remainingCount,
    winnersCount: raffle.winnersCount,
    eliminationsRemaining,
    eliminationsUntilNextPhase,
    phaseEndsApproxAt,
    eliminationIntervalMs: raffle.eliminationIntervalMs,
    lastEliminationAt: raffle.lastEliminationAt ? raffle.lastEliminationAt.toISOString() : null,
    nextEliminationAt,
    // Phase 2
    lightState: raffle.lightState,
    nextWindAt,
    nextLightChangeAt,
    // Phase 3 / shared intro lobby
    phase3StartsAt,
    phaseIntroEndsAt,
    phase3StartedAt,
    nextHorseAdvanceAt,
    nextHorseEliminationAt,
    lastPlace,
    isFinaleStretch: raffle.drawPhase === "phase3" && remainingCount <= 3,
    // Active interval lengths so the FE can render the depleting progress
    // bars without hard-coding the values (especially since phase 3 timings
    // shift down once the finale stretch starts).
    intervals: {
      phase1Ms: phase1IntervalMs(),
      phase2WindMs: phase2WindIntervalMs(),
      phase2LightMs: phase2LightIntervalMs(),
      phase3AdvanceMs: phase3AdvanceIntervalMs(remainingCount),
      phase3EliminationMs: phase3EliminationIntervalMs(remainingCount),
    },
    // Rosters
    aliveTickets: aliveRoster,
    recentEliminated,
    winners,
  };
};
