import { prisma } from "../../models/prisma";
import { padTicket } from "../../services/raffle-draw";

export const getMyRaffleHistory = async (userId: number) => {
  const tickets = await prisma.raffleTicket.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      raffle: {
        select: {
          id: true,
          slug: true,
          title: true,
          imageUrl: true,
          status: true,
          ticketPrice: true,
          currency: true,
          drawAt: true,
          drawType: true,
          maxTickets: true,
          winnerTicketId: true,
        },
      },
    },
  });

  const refunds = await prisma.raffleRefund.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      raffle: { select: { slug: true, title: true, imageUrl: true } },
      raffleTicket: { select: { number: true } },
    },
  });

  return {
    tickets: tickets.map((t) => ({
      id: t.id,
      number: padTicket(t.number),
      comment: t.comment,
      amountPaid: t.amountPaid,
      refundedAt: t.refundedAt,
      createdAt: t.createdAt,
      isWinner: t.id === t.raffle.winnerTicketId,
      raffle: {
        slug: t.raffle.slug,
        title: t.raffle.title,
        imageUrl: t.raffle.imageUrl,
        status: t.raffle.status,
        ticketPrice: t.raffle.ticketPrice,
        currency: t.raffle.currency,
        drawType: t.raffle.drawType,
        drawAt: t.raffle.drawAt,
        maxTickets: t.raffle.maxTickets,
      },
    })),
    refunds: refunds.map((r) => ({
      id: r.id,
      ticketNumber: padTicket(r.raffleTicket.number),
      amount: r.amount,
      currency: r.currency,
      paypalRefundId: r.paypalRefundId,
      status: r.status,
      failureReason: r.failureReason,
      createdAt: r.createdAt,
      raffle: r.raffle,
    })),
  };
};
