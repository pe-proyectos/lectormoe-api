import { prisma } from "../../models/prisma";
import { padTicket } from "../../services/raffle-draw";

// Mirrors the constants in raffle-draw.ts. Kept here so the FE can compute
// "next X in Ys" countdowns from `last*At` timestamps without needing the
// service to publish a separate "next*At" for each timer.
const PHASE1_INTERVAL_MS = 5_000;
const PHASE1_TARGET = 30;
const PHASE2_TARGET = 10;
const PHASE2_WIND_INTERVAL_MS = 3_000;
const PHASE2_LIGHT_INTERVAL_MS = 10_000;
const PHASE3_ADVANCE_INTERVAL_MS = 3_000;
const PHASE3_ELIMINATION_INTERVAL_MS = 15_000;

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

  // Coarse ETA when phase 1 ends (5s × eliminations remaining in phase 1).
  // Useful for a "termina aprox en Xs" hint. Phase 2 is non-deterministic
  // (depends on light state) so we don't try; phase 3 also uses 15s × kills.
  let phaseEndsApproxAt: string | null = null;
  if (raffle.drawPhase === "phase1") {
    const ms = Math.max(0, remainingCount - PHASE1_TARGET) * PHASE1_INTERVAL_MS;
    phaseEndsApproxAt = new Date(Date.now() + ms).toISOString();
  } else if (raffle.drawPhase === "phase3") {
    const ms = Math.max(0, remainingCount - raffle.winnersCount) * PHASE3_ELIMINATION_INTERVAL_MS;
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
      ? new Date(raffle.lastWindAt.getTime() + PHASE2_WIND_INTERVAL_MS).toISOString()
      : raffle.drawPhase === "phase2"
      ? new Date(Date.now() + PHASE2_WIND_INTERVAL_MS).toISOString()
      : null;
  const nextLightChangeAt =
    raffle.drawPhase === "phase2" && raffle.lastLightChangeAt
      ? new Date(raffle.lastLightChangeAt.getTime() + PHASE2_LIGHT_INTERVAL_MS).toISOString()
      : null;

  // Phase 3 intro / phase 3 ticking.
  const phase3StartsAt =
    raffle.drawPhase === "phase3_intro" && raffle.phase3StartedAt
      ? raffle.phase3StartedAt.toISOString()
      : null;
  const nextHorseAdvanceAt =
    raffle.drawPhase === "phase3" && raffle.lastHorseAdvanceAt
      ? new Date(raffle.lastHorseAdvanceAt.getTime() + PHASE3_ADVANCE_INTERVAL_MS).toISOString()
      : raffle.drawPhase === "phase3"
      ? new Date(Date.now() + PHASE3_ADVANCE_INTERVAL_MS).toISOString()
      : null;
  const nextHorseEliminationAt =
    raffle.drawPhase === "phase3" && raffle.lastHorseEliminationAt
      ? new Date(raffle.lastHorseEliminationAt.getTime() + PHASE3_ELIMINATION_INTERVAL_MS).toISOString()
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
    // Phase 3
    phase3StartsAt,
    nextHorseAdvanceAt,
    nextHorseEliminationAt,
    lastPlace,
    // Rosters
    aliveTickets: aliveRoster,
    recentEliminated,
    winners,
  };
};
