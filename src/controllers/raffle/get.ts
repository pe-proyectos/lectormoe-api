import { prisma } from "../../models/prisma";
import { padTicket } from "../../services/raffle-draw";

export const getRaffleBySlug = async (slug: string, currentUserId: number | null) => {
  const r = await prisma.raffle.findUnique({
    where: { slug },
    include: { _count: { select: { tickets: true } } },
  });
  if (!r || r.deletedAt) return null;

  let userTicketCount = 0;
  if (currentUserId) {
    userTicketCount = await prisma.raffleTicket.count({
      where: { raffleId: r.id, userId: currentUserId, refundedAt: null },
    });
  }

  let winner: any = null;
  if ((r.status === "completed" || r.status === "drawing") && r.winnerUserId && r.winnerTicketId) {
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
    imageUrl: r.imageUrl,
    bannerUrl: r.bannerUrl,
    ticketPrice: r.ticketPrice,
    currency: r.currency,
    minTickets: r.minTickets,
    maxTickets: r.maxTickets,
    maxTicketsPerUser: r.maxTicketsPerUser,
    drawType: r.drawType,
    drawAt: r.drawAt,
    status: r.status,
    cancelReason: r.cancelReason,
    revealStartedAt: r.revealStartedAt,
    revealOrder: r.revealOrder,
    revealDigits: r.revealDigits,
    sold: r._count.tickets,
    available: Math.max(0, r.maxTickets - r._count.tickets),
    userTicketCount,
    winner,
    createdAt: r.createdAt,
  };
};
