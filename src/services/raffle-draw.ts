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

export const padTicket = (n: number) => n.toString().padStart(5, "0");

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
    await executeCancel(raffleId, "No se alcanzó la cantidad mínima de tickets");
    return;
  }

  const winnersCount = Math.max(1, raffle.winnersCount ?? 1);
  const intervalMs = Math.max(0, raffle.eliminationIntervalMs ?? 5000);

  // Short-circuit: not enough tickets to actually eliminate anyone — everyone
  // wins. No SSE elimination events, just flip to completed.
  if (raffle.tickets.length <= winnersCount) {
    const survivors = await prisma.raffleTicket.findMany({
      where: { raffleId },
      orderBy: { number: "asc" },
      include: { user: { select: { slug: true, username: true, imageUrl: true } } },
    });
    const lowest = survivors[0];
    await prisma.raffle.update({
      where: { id: raffleId },
      data: {
        status: "completed",
        winnerTicketId: lowest?.id ?? null,
        winnerUserId: lowest?.userId ?? null,
      },
    });
    broadcast(raffleId, {
      type: "draw_completed",
      winners: buildWinnerEntries(survivors),
    });
    return;
  }

  const startedAt = new Date();
  await prisma.raffle.update({
    where: { id: raffleId },
    data: {
      status: "drawing",
      lastEliminationAt: null,
      // Stamp legacy reveal fields as null so anything inspecting them sees a
      // clean elimination-tournament raffle (not a half-completed legacy one).
      revealStartedAt: null,
      revealOrder: null as any,
      revealDigits: null,
    },
  });

  broadcast(raffleId, {
    type: "draw_started",
    totalTickets: raffle.tickets.length,
    winnersCount,
    eliminationIntervalMs: intervalMs,
    startedAt: startedAt.toISOString(),
  });

  const eliminationsNeeded = raffle.tickets.length - winnersCount;
  const shuffledTicketIds = shuffle(raffle.tickets.map((t) => t.id)).slice(0, eliminationsNeeded);

  const scheduleNext = (index: number) => {
    if (index >= shuffledTicketIds.length) {
      // Finalisation step.
      setTimeout(async () => {
        try {
          const current = await prisma.raffle.findUnique({
            where: { id: raffleId },
            select: { id: true, status: true },
          });
          if (!current || current.status !== "drawing") return;

          const survivors = await prisma.raffleTicket.findMany({
            where: { raffleId, eliminatedAt: null },
            orderBy: { number: "asc" },
            include: { user: { select: { slug: true, username: true, imageUrl: true } } },
          });
          const lowest = survivors[0];
          await prisma.raffle.update({
            where: { id: raffleId },
            data: {
              status: "completed",
              winnerTicketId: lowest?.id ?? null,
              winnerUserId: lowest?.userId ?? null,
            },
          });
          broadcast(raffleId, {
            type: "draw_completed",
            winners: buildWinnerEntries(survivors),
          });
        } catch (err) {
          console.error(`[raffle-draw] Failed to finalise draw for raffle #${raffleId}:`, err);
        }
      }, intervalMs);
      return;
    }

    setTimeout(async () => {
      try {
        // Defensive: handle cancel/delete mid-tournament.
        const current = await prisma.raffle.findUnique({
          where: { id: raffleId },
          select: { id: true, status: true },
        });
        if (!current || current.status !== "drawing") return;

        const ticketId = shuffledTicketIds[index];
        const eliminationOrder = index + 1;
        const now = new Date();
        const eliminated = await prisma.raffleTicket.update({
          where: { id: ticketId },
          data: { eliminatedAt: now, eliminationOrder },
          include: { user: { select: { slug: true, username: true, imageUrl: true } } },
        });
        await prisma.raffle.update({
          where: { id: raffleId },
          data: { lastEliminationAt: now },
        });

        const remainingCount = raffle.tickets.length - eliminationOrder;
        broadcast(raffleId, {
          type: "elimination",
          ticketNumber: padTicket(eliminated.number),
          userSlug: eliminated.user.slug,
          userUsername: eliminated.user.username,
          userImageUrl: eliminated.user.imageUrl,
          comment: eliminated.comment,
          eliminationOrder,
          remainingCount,
        });

        scheduleNext(index + 1);
      } catch (err) {
        console.error(`[raffle-draw] Elimination ${index + 1} failed for raffle #${raffleId}:`, err);
      }
    }, intervalMs);
  };

  scheduleNext(0);
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
