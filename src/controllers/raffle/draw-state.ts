import { prisma } from "../../models/prisma";
import { padTicket } from "../../services/raffle-draw";

export const getRaffleDrawState = async (slug: string) => {
  const raffle = await prisma.raffle.findUnique({
    where: { slug },
    select: {
      id: true,
      status: true,
      winnersCount: true,
      eliminationIntervalMs: true,
      lastEliminationAt: true,
      deletedAt: true,
    },
  });
  if (!raffle || raffle.deletedAt) return null;

  const [totalTickets, eliminatedCount, recentEliminatedRows, winnersRows] = await Promise.all([
    prisma.raffleTicket.count({ where: { raffleId: raffle.id } }),
    prisma.raffleTicket.count({ where: { raffleId: raffle.id, eliminatedAt: { not: null } } }),
    prisma.raffleTicket.findMany({
      where: { raffleId: raffle.id, eliminatedAt: { not: null } },
      orderBy: { eliminationOrder: "desc" },
      take: 5,
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

  const recentEliminated = recentEliminatedRows.map((t) => ({
    number: padTicket(t.number),
    userSlug: t.user.slug,
    userUsername: t.user.username,
    userImageUrl: t.user.imageUrl,
    comment: t.comment,
    eliminationOrder: t.eliminationOrder ?? 0,
  }));

  const lastEliminated = recentEliminated[0] ?? null;

  const nextEliminationAt =
    raffle.status === "drawing" && raffle.lastEliminationAt
      ? new Date(raffle.lastEliminationAt.getTime() + raffle.eliminationIntervalMs).toISOString()
      : null;

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
    totalTickets,
    eliminatedCount,
    remainingCount,
    winnersCount: raffle.winnersCount,
    eliminationsRemaining,
    eliminationIntervalMs: raffle.eliminationIntervalMs,
    lastEliminationAt: raffle.lastEliminationAt ? raffle.lastEliminationAt.toISOString() : null,
    nextEliminationAt,
    lastEliminated,
    recentEliminated,
    winners,
  };
};
