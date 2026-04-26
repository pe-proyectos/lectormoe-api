import { prisma } from "../models/prisma";
import { refundPaypalCapture } from "../util/paypal";
import { broadcast } from "./raffle-events";

const DIGIT_REVEAL_MS = 5_000;
const REVEAL_PADDING_MS = 10_000;
const TOTAL_REVEAL_MS = DIGIT_REVEAL_MS * 5 + REVEAL_PADDING_MS;

const shuffle = <T,>(arr: T[]): T[] => {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export const padTicket = (n: number) => n.toString().padStart(5, "0");

export async function executeDraw(raffleId: number): Promise<void> {
  const raffle = await prisma.raffle.findUnique({
    where: { id: raffleId },
    include: { tickets: true },
  });
  if (!raffle) throw new Error(`Raffle #${raffleId} not found.`);
  if (raffle.status !== "active") {
    console.log(`[raffle-draw] raffle #${raffleId} is not active (status=${raffle.status}); skipping.`);
    return;
  }

  if (raffle.tickets.length < raffle.minTickets) {
    await executeCancel(raffleId, "min-not-reached");
    return;
  }

  const winner = raffle.tickets[Math.floor(Math.random() * raffle.tickets.length)];
  const revealOrder = shuffle([0, 1, 2, 3, 4]);
  const revealDigits = padTicket(winner.number);
  const revealStartedAt = new Date();

  await prisma.raffle.update({
    where: { id: raffleId },
    data: {
      status: "drawing",
      winnerTicketId: winner.id,
      winnerUserId: winner.userId,
      revealStartedAt,
      revealOrder,
      revealDigits,
    },
  });

  broadcast(raffleId, {
    type: "draw_started",
    revealOrder,
    revealDigits,
    revealStartedAt: revealStartedAt.toISOString(),
  });

  // Schedule the completion broadcast and status flip after the animation.
  setTimeout(async () => {
    try {
      // Defensive: the raffle could have been hard-deleted (test cleanup, manual
      // wipe) between draw_started and the completion timer. Skip the update
      // and broadcast in that case instead of throwing.
      const stillExists = await prisma.raffle.findUnique({
        where: { id: raffleId },
        select: { id: true, status: true },
      });
      if (!stillExists || stillExists.status === "completed") return;

      const winnerUser = await prisma.user.findUnique({
        where: { id: winner.userId },
        select: { slug: true, username: true, imageUrl: true },
      });
      await prisma.raffle.update({
        where: { id: raffleId },
        data: { status: "completed" },
      });
      broadcast(raffleId, {
        type: "draw_completed",
        winner: {
          ticketNumber: revealDigits,
          userSlug: winnerUser?.slug ?? "",
          userUsername: winnerUser?.username ?? "",
          userImageUrl: winnerUser?.imageUrl ?? null,
        },
      });
    } catch (err) {
      console.error(`[raffle-draw] Failed to complete draw for raffle #${raffleId}:`, err);
    }
  }, TOTAL_REVEAL_MS);
}

export async function executeCancel(raffleId: number, reason: string): Promise<void> {
  const raffle = await prisma.raffle.findUnique({
    where: { id: raffleId },
    include: { tickets: { include: { refund: true } } },
  });
  if (!raffle) throw new Error(`Raffle #${raffleId} not found.`);
  if (raffle.status === "completed" || raffle.status === "cancelled") {
    console.log(`[raffle-draw] raffle #${raffleId} already finalised (status=${raffle.status}); skipping cancel.`);
    return;
  }

  await prisma.raffle.update({
    where: { id: raffleId },
    data: { status: "cancelled", cancelReason: reason },
  });

  for (const ticket of raffle.tickets) {
    if (ticket.refund) continue;
    if (ticket.paypalCaptureId && ticket.amountPaid > 0) {
      let refundResult: any = null;
      let status: "completed" | "failed" = "completed";
      let failureReason: string | null = null;
      let paypalRefundId: string | null = null;
      try {
        refundResult = await refundPaypalCapture(ticket.paypalCaptureId, {
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
    } else {
      // Free raffle ticket — zero billing footprint: no refund row, no PayPal call.
      // Just stamp the ticket as refunded for symmetry with paid flow.
      await prisma.raffleTicket.update({
        where: { id: ticket.id },
        data: { refundedAt: new Date() },
      });
    }
  }

  broadcast(raffleId, { type: "cancelled", reason });
}
