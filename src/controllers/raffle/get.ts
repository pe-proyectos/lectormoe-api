import { prisma } from "../../models/prisma";
import { padTicket } from "../../services/raffle-draw";
import { isInGuildCached } from "../../services/discord-membership";
import { resolveR2Url } from "../../util/r2-url";

export const getRaffleBySlug = async (slug: string, currentUserId: number | null) => {
  const r = await prisma.raffle.findUnique({
    where: { slug },
    include: { _count: { select: { tickets: true } } },
  });
  if (!r || r.deletedAt) return null;

  let userTicketCount = 0;
  let viewerDiscord: { linked: boolean; verified: boolean; reason?: string } = {
    linked: false,
    verified: false,
    reason: "not-logged",
  };
  // Phase 1 gate: only emailVerified is required to participate. Discord is an
  // optional badge / future stricter gate.
  let viewerCanParticipate = false;
  let viewerBlockReason: string | null = "not-logged";
  if (currentUserId) {
    userTicketCount = await prisma.raffleTicket.count({
      where: { raffleId: r.id, userId: currentUserId, refundedAt: null },
    });

    const u = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { discordId: true, emailVerified: true },
    });
    viewerCanParticipate = !!u?.emailVerified;
    viewerBlockReason = u?.emailVerified ? null : "email-not-verified";
    if (!u?.discordId) {
      viewerDiscord = { linked: false, verified: false, reason: "not-linked" };
    } else {
      // Use cached check so the detail render doesn't slam Discord every load.
      try {
        const inGuild = await isInGuildCached(u.discordId);
        viewerDiscord = inGuild
          ? { linked: true, verified: true }
          : { linked: true, verified: false, reason: "not-in-guild" };
      } catch {
        viewerDiscord = { linked: true, verified: false, reason: "check-failed" };
      }
    }
  }

  let winners: any[] | null = null;
  if (r.status === "completed") {
    const survivors = await prisma.raffleTicket.findMany({
      where: { raffleId: r.id, eliminatedAt: null },
      orderBy: { number: "asc" },
      include: { user: { select: { slug: true, username: true, imageUrl: true } } },
    });
    winners = survivors.map((t) => ({
      ticketNumber: padTicket(t.number),
      userSlug: t.user.slug,
      userUsername: t.user.username,
      userImageUrl: t.user.imageUrl,
      comment: t.comment,
    }));
  }

  // Legacy single 'winner' field — points at the lowest-numbered surviving
  // ticket so old consumers keep working. For status=drawing we still resolve
  // it from winnerTicketId/winnerUserId in case anything was stamped early
  // (legacy raffles); otherwise it's null until completion.
  let winner: any = null;
  if (winners && winners.length > 0) {
    winner = winners[0];
  } else if (r.status === "drawing" && r.winnerUserId && r.winnerTicketId) {
    const [user, ticket] = await Promise.all([
      prisma.user.findUnique({
        where: { id: r.winnerUserId },
        select: { slug: true, username: true, imageUrl: true },
      }),
      prisma.raffleTicket.findUnique({
        where: { id: r.winnerTicketId },
        select: { number: true },
      }),
    ]);
    winner = {
      ticketNumber: ticket ? padTicket(ticket.number) : null,
      userSlug: user?.slug ?? null,
      userUsername: user?.username ?? null,
      userImageUrl: user?.imageUrl ?? null,
    };
  }

  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    description: r.description,
    imageUrl: resolveR2Url(r.imageUrl),
    bannerUrl: resolveR2Url(r.bannerUrl),
    ticketPrice: r.ticketPrice,
    currency: r.currency,
    minTickets: r.minTickets,
    maxTickets: r.maxTickets,
    maxTicketsPerUser: r.maxTicketsPerUser,
    winnersCount: r.winnersCount,
    eliminationIntervalMs: r.eliminationIntervalMs,
    drawType: r.drawType,
    drawAt: r.drawAt,
    status: r.status,
    completedAt: r.completedAt,
    cancelReason: r.cancelReason,
    revealStartedAt: r.revealStartedAt,
    revealOrder: r.revealOrder,
    revealDigits: r.revealDigits,
    sold: r._count.tickets,
    available: Math.max(0, r.maxTickets - r._count.tickets),
    userTicketCount,
    winner,
    winners,
    viewer: {
      discord: viewerDiscord,
      canParticipate: viewerCanParticipate,
      blockReason: viewerBlockReason,
    },
    createdAt: r.createdAt,
  };
};
