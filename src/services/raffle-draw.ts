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
    // Defensive: layout assumes 5-char zero-padded numbers. If this ever
    // fires, we have data outside the contract — surface loudly instead of
    // silently rendering a 6-char string and breaking UI alignment.
    throw new Error(`padTicket: ticket number ${n} out of range (0..${MAX_TICKET_NUMBER}).`);
  }
  return Math.floor(n).toString().padStart(5, "0");
};

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

// ─── Timer registry ────────────────────────────────────────────────────────
//
// Active draws schedule eliminations via setTimeout chains. We track the
// pending timer per raffle so executeCancel() can abort cleanly — without
// this, a cancel mid-draw would race against the next scheduled tick (the
// status guard catches most cases but not the finalisation tick that fires
// AFTER the last elimination commit).
//
// In-memory only: surviving a process restart is handled separately by
// resumeStuckDraws() (called from the recovery cron).
const pendingTimers = new Map<number, ReturnType<typeof setTimeout>>();

const clearPendingTimer = (raffleId: number) => {
  const t = pendingTimers.get(raffleId);
  if (t) {
    clearTimeout(t);
    pendingTimers.delete(raffleId);
  }
};

// ─── Atomic status guard ───────────────────────────────────────────────────
//
// `updateMany` returns the count of affected rows. By including `status` in
// the WHERE clause, exactly one concurrent caller can win the flip from
// "active" → "drawing"; the others get count=0 and bail out. This is the
// single point that prevents two parallel elimination chains for the same
// raffle (cron + manual trigger racing, or two cron ticks overlapping).
const tryClaimDraw = async (raffleId: number): Promise<boolean> => {
  const result = await prisma.raffle.updateMany({
    where: { id: raffleId, status: "active" },
    data: {
      status: "drawing",
      lastEliminationAt: null,
      revealStartedAt: null,
      revealOrder: null as any,
      revealDigits: null,
    },
  });
  return result.count === 1;
};

export async function executeDraw(raffleId: number): Promise<void> {
  // Read raffle for validation BEFORE we try to claim — we need to know
  // tickets, minTickets, winnersCount, etc. Status is re-validated atomically
  // inside tryClaimDraw().
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
  const intervalMs = Math.max(0, raffle.eliminationIntervalMs ?? 5000);

  // Short-circuit: not enough tickets to actually eliminate anyone — everyone
  // wins. We still need atomic status guard so a second concurrent caller
  // doesn't double-broadcast draw_completed.
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
      },
    });
    if (finalised.count !== 1) {
      console.log(`[raffle-draw] raffle #${raffleId} short-circuit lost status race; skipping broadcast.`);
      return;
    }
    broadcast(raffleId, {
      type: "draw_completed",
      winners: buildWinnerEntries(survivors),
    });
    return;
  }

  // Atomic claim: only one caller proceeds past this point.
  const claimed = await tryClaimDraw(raffleId);
  if (!claimed) {
    console.log(`[raffle-draw] raffle #${raffleId} status race lost (already drawing/finalised); skipping.`);
    return;
  }

  const startedAt = new Date();
  broadcast(raffleId, {
    type: "draw_started",
    totalTickets: raffle.tickets.length,
    winnersCount,
    eliminationIntervalMs: intervalMs,
    startedAt: startedAt.toISOString(),
  });

  const eliminationsNeeded = raffle.tickets.length - winnersCount;
  const shuffledTicketIds = shuffle(raffle.tickets.map((t) => t.id)).slice(0, eliminationsNeeded);

  runEliminationChain(raffleId, shuffledTicketIds, raffle.tickets.length, winnersCount, intervalMs, 0);
}

// Extracted so resumeStuckDraws() can re-invoke without re-claiming status.
function runEliminationChain(
  raffleId: number,
  shuffledTicketIds: number[],
  totalTickets: number,
  _winnersCount: number,
  intervalMs: number,
  startIndex: number,
): void {
  const scheduleNext = (index: number) => {
    if (index >= shuffledTicketIds.length) {
      // Finalisation step.
      const t = setTimeout(async () => {
        pendingTimers.delete(raffleId);
        try {
          // Atomic finalise: only commit if status is still "drawing". This
          // catches the rare microsecond where executeCancel slipped through
          // between the last elimination commit and this tick.
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
            },
          });
          if (finalised.count !== 1) {
            console.log(`[raffle-draw] raffle #${raffleId} finalise skipped (status changed under us).`);
            return;
          }
          broadcast(raffleId, {
            type: "draw_completed",
            winners: buildWinnerEntries(survivors),
          });
        } catch (err) {
          console.error(`[raffle-draw] Failed to finalise draw for raffle #${raffleId}:`, err);
        }
      }, intervalMs);
      pendingTimers.set(raffleId, t);
      return;
    }

    const t = setTimeout(async () => {
      pendingTimers.delete(raffleId);
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

        const remainingCount = totalTickets - eliminationOrder;
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
    pendingTimers.set(raffleId, t);
  };

  scheduleNext(startIndex);
}

export async function executeCancel(raffleId: number, reason: string): Promise<void> {
  // Tear down any pending elimination timer FIRST so a tick can't fire
  // between us flipping to "cancelled" and the loop's next status check.
  clearPendingTimer(raffleId);

  const raffle = await prisma.raffle.findUnique({
    where: { id: raffleId },
    include: { tickets: { include: { refund: true } } },
  });
  if (!raffle) throw new Error(`Raffle #${raffleId} not found.`);
  if (raffle.status === "completed" || raffle.status === "cancelled") {
    console.log(`[raffle-draw] raffle #${raffleId} already finalised (status=${raffle.status}); skipping cancel.`);
    return;
  }

  // Atomic cancel: only flip if not already finalised. Prevents racing with
  // a finalisation tick that may have started but not committed yet.
  const cancelled = await prisma.raffle.updateMany({
    where: { id: raffleId, status: { in: ["active", "drawing"] } },
    data: { status: "cancelled", cancelReason: reason },
  });
  if (cancelled.count !== 1) {
    console.log(`[raffle-draw] raffle #${raffleId} cancel race lost (already finalised).`);
    return;
  }

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
    } else if (ticket.paypalCaptureId && ticket.amountPaid <= 0) {
      // Defensive: capture id present but no amount recorded. This shouldn't
      // happen but if it does we don't want to call PayPal with $0 (errors)
      // or skip refund logging entirely. Log and stamp ticket only.
      console.warn(`[raffle-draw] ticket #${ticket.id} has paypalCaptureId but amountPaid=${ticket.amountPaid}; skipping refund call.`);
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

// ─── Recovery: stuck-drawing raffles ───────────────────────────────────────
//
// If the API process restarts mid-tournament, every pending setTimeout dies.
// The cron calls this on each tick to find raffles in status="drawing" with
// stale lastEliminationAt and either resume the chain (if there are still
// eliminations to do) or finalise (if all eliminations were already
// committed before the crash).
//
// "Stale" = lastEliminationAt older than 3× eliminationIntervalMs (or 30s
// for fresh draws with no eliminations yet) — we use a generous window to
// avoid stomping on a slow-but-progressing chain in another worker.
export async function resumeStuckDraws(): Promise<void> {
  try {
    const drawing = await prisma.raffle.findMany({
      where: { status: "drawing", deletedAt: null },
      include: { tickets: true },
    });
    if (drawing.length === 0) return;

    const now = Date.now();
    for (const raffle of drawing) {
      // Skip if we already own a timer for this raffle in THIS process —
      // means the chain is alive locally and ticking.
      if (pendingTimers.has(raffle.id)) continue;

      const intervalMs = Math.max(0, raffle.eliminationIntervalMs ?? 5000);
      const stalenessThreshold = Math.max(30_000, intervalMs * 3);
      const lastTickMs = raffle.lastEliminationAt?.getTime() ?? 0;
      // For fresh draws with no eliminations yet, lastEliminationAt is null;
      // give them a full stalenessThreshold from raffle.updatedAt.
      const reference = lastTickMs > 0 ? lastTickMs : (raffle.updatedAt?.getTime() ?? 0);
      if (now - reference < stalenessThreshold) continue;

      console.warn(`[raffle-draw] resuming stuck draw for raffle #${raffle.id} (last tick ${reference > 0 ? new Date(reference).toISOString() : 'never'})`);

      const winnersCount = Math.max(1, raffle.winnersCount ?? 1);
      const eliminatedTicketIds = new Set(
        raffle.tickets.filter((t) => t.eliminatedAt !== null).map((t) => t.id),
      );
      const aliveTickets = raffle.tickets.filter((t) => t.eliminatedAt === null);

      if (aliveTickets.length <= winnersCount) {
        // All required eliminations already committed — finalise immediately.
        try {
          const survivors = await prisma.raffleTicket.findMany({
            where: { raffleId: raffle.id, eliminatedAt: null },
            orderBy: { number: "asc" },
            include: { user: { select: { slug: true, username: true, imageUrl: true } } },
          });
          const lowest = survivors[0];
          const finalised = await prisma.raffle.updateMany({
            where: { id: raffle.id, status: "drawing" },
            data: {
              status: "completed",
              winnerTicketId: lowest?.id ?? null,
              winnerUserId: lowest?.userId ?? null,
            },
          });
          if (finalised.count === 1) {
            broadcast(raffle.id, {
              type: "draw_completed",
              winners: buildWinnerEntries(survivors),
            });
          }
        } catch (err) {
          console.error(`[raffle-draw] resume finalise failed for raffle #${raffle.id}:`, err);
        }
        continue;
      }

      // Re-derive the remaining elimination order. We don't know the
      // original shuffle, so we shuffle the still-alive tickets fresh.
      const stillAliveIds = aliveTickets.map((t) => t.id);
      const remainingNeeded = aliveTickets.length - winnersCount;
      const remainingShuffled = shuffle(stillAliveIds).slice(0, remainingNeeded);
      // For broadcast remainingCount math we treat the eliminated set as
      // already committed; index continues from the count of eliminated
      // tickets so eliminationOrder stays monotonic.
      const startIndex = eliminatedTicketIds.size;
      const totalForBroadcast = startIndex + remainingShuffled.length + winnersCount;
      // Build a virtual chain that skips the already-eliminated entries.
      const virtualChain: number[] = [
        ...Array.from({ length: startIndex }, () => -1), // placeholders (unreached)
        ...remainingShuffled,
      ];
      runEliminationChain(raffle.id, virtualChain, totalForBroadcast, winnersCount, intervalMs, startIndex);
    }
  } catch (err) {
    console.error("[raffle-draw] resumeStuckDraws failed:", err);
  }
}
