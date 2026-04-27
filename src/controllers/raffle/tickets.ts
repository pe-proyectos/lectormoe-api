import { prisma } from "../../models/prisma";
import { padTicket, executeDraw } from "../../services/raffle-draw";
import { broadcast } from "../../services/raffle-events";
import { capturePaypalOrder, createPaypalOrder, refundPaypalCapture } from "../../util/paypal";
// Phase 1 gate: only require a verified email to participate. Discord linking
// is exposed in /settings as an optional connection (badge in raffles, used
// later for stricter gating once the bot is fully wired in prod). Keeping the
// helper around so we can re-enable bot-membership gating with a one-line swap.
const requireRafflePrerequisites = async (userId: number) => {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerified: true },
  });
  if (!u) throw new Error("Usuario no encontrado.");
  if (!u.emailVerified) {
    throw new Error("Verifica tu correo electrónico antes de participar en el sorteo.");
  }
};

const TICKETS_PAGE_DEFAULT = 30;

// Viewer's own tickets in a single raffle, with status (alive / eliminated /
// winner). Used by the "Mis tickets" strip in the raffle detail page so the
// user can see at a glance whether their tickets survived.
export const listMyRaffleTickets = async (slug: string, userId: number) => {
  const raffle = await prisma.raffle.findUnique({
    where: { slug },
    select: { id: true, status: true, deletedAt: true },
  });
  if (!raffle || raffle.deletedAt) throw new Error("Sorteo no encontrado.");

  const tickets = await prisma.raffleTicket.findMany({
    where: { raffleId: raffle.id, userId },
    orderBy: { number: "asc" },
    select: {
      id: true,
      number: true,
      eliminatedAt: true,
      eliminationOrder: true,
      refundedAt: true,
      comment: true,
    },
  });

  // A surviving ticket on a completed raffle = winner.
  const isCompleted = raffle.status === "completed";
  return tickets.map((t) => ({
    id: t.id,
    number: padTicket(t.number),
    comment: t.comment,
    refunded: t.refundedAt !== null,
    eliminated: t.eliminatedAt !== null,
    eliminationOrder: t.eliminationOrder,
    isWinner: isCompleted && t.eliminatedAt === null && !t.refundedAt,
    alive: t.eliminatedAt === null && !t.refundedAt && !isCompleted,
  }));
};

export const listRaffleTickets = async (slug: string, params: {
  page?: number;
  limit?: number;
  q?: string;
}) => {
  const raffle = await prisma.raffle.findUnique({ where: { slug } });
  if (!raffle || raffle.deletedAt) throw new Error("Sorteo no encontrado.");

  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? TICKETS_PAGE_DEFAULT));

  const where: any = { raffleId: raffle.id };
  if (params.q && params.q.trim().length > 0) {
    const q = params.q.trim();
    where.user = {
      OR: [
        { username: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
      ],
    };
  }

  // Sort: alive tickets (eliminatedAt IS NULL) first by number ASC, then
  // eliminated tickets by eliminationOrder ASC. Postgres NULLS FIRST when
  // sorting ASC means alive rows naturally precede eliminated rows on
  // eliminationOrder; we use number as the secondary key for alive rows and
  // eliminationOrder is unique per raffle for eliminated rows.
  const [tickets, total] = await Promise.all([
    prisma.raffleTicket.findMany({
      where,
      orderBy: [
        { eliminationOrder: { sort: "asc", nulls: "first" } },
        { number: "asc" },
      ],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { slug: true, username: true, imageUrl: true } },
      },
    }),
    prisma.raffleTicket.count({ where }),
  ]);

  return {
    items: tickets.map((t) => ({
      id: t.id,
      number: padTicket(t.number),
      userSlug: t.user.slug,
      userUsername: t.user.username,
      userImageUrl: t.user.imageUrl,
      comment: t.comment,
      eliminatedAt: t.eliminatedAt,
      eliminationOrder: t.eliminationOrder,
      createdAt: t.createdAt,
    })),
    total,
    page,
    limit,
  };
};

export const createPaypalOrderForRaffle = async (slug: string, userId: number, count: number) => {
  const raffle = await prisma.raffle.findUnique({
    where: { slug },
    include: { _count: { select: { tickets: true } } },
  });
  if (!raffle || raffle.deletedAt) throw new Error("Sorteo no encontrado.");
  if (raffle.status !== "active") throw new Error("El sorteo no está activo.");
  if (raffle.ticketPrice <= 0) throw new Error("Este sorteo es gratuito; no requiere PayPal.");
  if (count < 1) throw new Error("Cantidad inválida.");

  await requireRafflePrerequisites(userId);

  const sold = raffle._count.tickets;
  const available = raffle.maxTickets - sold;
  if (count > available) throw new Error(`Solo quedan ${available} tickets disponibles.`);

  const userOwned = await prisma.raffleTicket.count({
    where: { raffleId: raffle.id, userId, refundedAt: null },
  });
  if (userOwned + count > raffle.maxTicketsPerUser) {
    throw new Error(`Máximo ${raffle.maxTicketsPerUser} tickets por usuario.`);
  }

  const amount = raffle.ticketPrice * count;
  const order = await createPaypalOrder(amount, raffle.currency, raffle.slug);
  return { orderId: order.id, amount, currency: raffle.currency };
};

export const purchaseTickets = async (
  slug: string,
  userId: number,
  params: { count?: number; comment?: string; paypalOrderId?: string },
) => {
  // Pre-validation outside the transaction (fail fast for obvious issues).
  // Atomic re-checks happen inside the locked transaction below.
  const raffle = await prisma.raffle.findUnique({
    where: { slug },
    include: { _count: { select: { tickets: true } } },
  });
  if (!raffle || raffle.deletedAt) throw new Error("Sorteo no encontrado.");
  if (raffle.status !== "active") throw new Error("El sorteo no está activo.");

  await requireRafflePrerequisites(userId);

  const count = Math.max(1, Math.floor(params.count ?? 1));
  const preSold = raffle._count.tickets;
  const preAvailable = raffle.maxTickets - preSold;
  if (count > preAvailable) throw new Error(`Solo quedan ${preAvailable} tickets disponibles.`);

  const preOwned = await prisma.raffleTicket.count({
    where: { raffleId: raffle.id, userId, refundedAt: null },
  });
  if (preOwned + count > raffle.maxTicketsPerUser) {
    throw new Error(`Máximo ${raffle.maxTicketsPerUser} tickets por usuario.`);
  }

  // ─── PayPal capture (HTTP, slow) — done OUTSIDE the txn ───────────────
  // We don't want to hold a row lock during a remote API call. If the DB
  // transaction below fails after this succeeds, we refund.
  let captureId: string | null = null;
  let amountPaidPerTicket = 0;

  if (raffle.ticketPrice > 0) {
    if (!params.paypalOrderId) {
      throw new Error("Falta paypalOrderId para sorteo de pago.");
    }
    const captured: any = await capturePaypalOrder(params.paypalOrderId);
    if (captured?.status !== "COMPLETED") {
      throw new Error(`PayPal no completó la captura (status=${captured?.status}).`);
    }
    const purchaseUnit = captured?.purchase_units?.[0];
    const captureObj = purchaseUnit?.payments?.captures?.[0];
    captureId = captureObj?.id ?? null;
    const paidValue = parseFloat(captureObj?.amount?.value ?? "0");
    const expected = raffle.ticketPrice * count;
    if (Math.abs(paidValue - expected) > 0.01) {
      // Mismatch — refund the capture immediately so the user isn't stuck.
      if (captureId) {
        try {
          await refundPaypalCapture(captureId, {
            value: paidValue.toFixed(2),
            currency_code: raffle.currency,
          });
        } catch (refundErr) {
          console.error(`[raffle-tickets] amount-mismatch refund failed for capture ${captureId}:`, refundErr);
        }
      }
      throw new Error(`Importe de PayPal (${paidValue}) no coincide con el esperado (${expected}).`);
    }
    amountPaidPerTicket = raffle.ticketPrice;
  }

  const trimmedComment = params.comment?.trim().slice(0, 500) || null;

  // ─── Atomic allocation + insert with advisory lock ────────────────────
  // pg_advisory_xact_lock(raffleId) serialises all concurrent buys for THIS
  // raffle (other raffles unaffected). Holding it through the count→
  // allocate→insert window eliminates BOTH overcount past maxTickets AND
  // ticket number collisions. The lock auto-releases on txn commit/rollback.
  let created: Array<{ id: number; number: number; comment: string | null; amountPaid: number; createdAt: Date }>;
  let newSold: number;
  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock($1::int, 0)`, raffle.id);

      // Re-validate inside the lock.
      const fresh = await tx.raffle.findUnique({
        where: { id: raffle.id },
        select: { id: true, status: true, deletedAt: true, maxTickets: true, maxTicketsPerUser: true },
      });
      if (!fresh || fresh.deletedAt) throw new Error("Sorteo no encontrado.");
      if (fresh.status !== "active") throw new Error("El sorteo no está activo.");

      const [soldNow, lastNumberAgg, ownedNow] = await Promise.all([
        tx.raffleTicket.count({ where: { raffleId: raffle.id } }),
        tx.raffleTicket.aggregate({ where: { raffleId: raffle.id }, _max: { number: true } }),
        tx.raffleTicket.count({ where: { raffleId: raffle.id, userId, refundedAt: null } }),
      ]);
      const availableNow = fresh.maxTickets - soldNow;
      if (count > availableNow) throw new Error(`Solo quedan ${availableNow} tickets disponibles.`);
      if (ownedNow + count > fresh.maxTicketsPerUser) {
        throw new Error(`Máximo ${fresh.maxTicketsPerUser} tickets por usuario.`);
      }

      const start = (lastNumberAgg._max.number ?? 0) + 1;
      if (start + count - 1 > 99999) {
        throw new Error("Rango de números agotado.");
      }
      const numbers = Array.from({ length: count }, (_, i) => start + i);

      const rows: Array<{ id: number; number: number; comment: string | null; amountPaid: number; createdAt: Date }> = [];
      for (const n of numbers) {
        const t = await tx.raffleTicket.create({
          data: {
            raffleId: raffle.id,
            userId,
            number: n,
            comment: trimmedComment,
            paypalOrderId: params.paypalOrderId ?? null,
            paypalCaptureId: captureId,
            amountPaid: amountPaidPerTicket,
          },
          select: { id: true, number: true, comment: true, amountPaid: true, createdAt: true },
        });
        rows.push(t);
      }
      return { rows, newSold: soldNow + rows.length };
    }, { timeout: 15_000 });
    created = result.rows;
    newSold = result.newSold;
  } catch (err) {
    // DB write failed AFTER PayPal capture succeeded — refund the capture.
    if (captureId) {
      console.error(`[raffle-tickets] DB write failed after PayPal capture ${captureId}; refunding.`, err);
      try {
        await refundPaypalCapture(captureId, {
          value: (amountPaidPerTicket * count).toFixed(2),
          currency_code: raffle.currency,
        });
      } catch (refundErr) {
        console.error(`[raffle-tickets] CRITICAL: refund failed for capture ${captureId} after DB failure. Manual reconciliation required.`, refundErr);
      }
    }
    throw err;
  }

  broadcast(raffle.id, {
    type: "ticket_purchased",
    sold: newSold,
    available: Math.max(0, raffle.maxTickets - newSold),
  });

  // max-tickets raffles auto-draw inline once full.
  if (raffle.drawType === "max-tickets" && newSold >= raffle.maxTickets) {
    executeDraw(raffle.id).catch((err) =>
      console.error(`[raffle-tickets] auto-draw failed for #${raffle.id}:`, err),
    );
  }

  return {
    tickets: created.map((t) => ({
      id: t.id,
      number: padTicket(t.number),
      comment: t.comment,
      amountPaid: t.amountPaid,
      createdAt: t.createdAt,
    })),
  };
};
