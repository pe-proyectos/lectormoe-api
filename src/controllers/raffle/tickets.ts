import { prisma } from "../../models/prisma";
import { padTicket, executeDraw } from "../../services/raffle-draw";
import { broadcast } from "../../services/raffle-events";
import { capturePaypalOrder, createPaypalOrder } from "../../util/paypal";

const TICKETS_PAGE_DEFAULT = 30;

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

  const [tickets, total] = await Promise.all([
    prisma.raffleTicket.findMany({
      where,
      orderBy: { number: "asc" },
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

const allocateNextTicketNumbers = async (raffleId: number, count: number): Promise<number[]> => {
  // Postgres-friendly: find current max via aggregate; collisions handled by unique constraint.
  const last = await prisma.raffleTicket.aggregate({
    where: { raffleId },
    _max: { number: true },
  });
  const start = (last._max.number ?? 0) + 1;
  return Array.from({ length: count }, (_, i) => start + i);
};

export const purchaseTickets = async (
  slug: string,
  userId: number,
  params: { count?: number; comment?: string; paypalOrderId?: string },
) => {
  const raffle = await prisma.raffle.findUnique({
    where: { slug },
    include: { _count: { select: { tickets: true } } },
  });
  if (!raffle || raffle.deletedAt) throw new Error("Sorteo no encontrado.");
  if (raffle.status !== "active") throw new Error("El sorteo no está activo.");

  const count = Math.max(1, Math.floor(params.count ?? 1));
  const sold = raffle._count.tickets;
  const available = raffle.maxTickets - sold;
  if (count > available) throw new Error(`Solo quedan ${available} tickets disponibles.`);

  const userOwned = await prisma.raffleTicket.count({
    where: { raffleId: raffle.id, userId, refundedAt: null },
  });
  if (userOwned + count > raffle.maxTicketsPerUser) {
    throw new Error(`Máximo ${raffle.maxTicketsPerUser} tickets por usuario.`);
  }

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
    // Allow tiny rounding diff.
    if (Math.abs(paidValue - expected) > 0.01) {
      throw new Error(`Importe de PayPal (${paidValue}) no coincide con el esperado (${expected}).`);
    }
    amountPaidPerTicket = raffle.ticketPrice;
  }

  const numbers = await allocateNextTicketNumbers(raffle.id, count);
  const trimmedComment = params.comment?.trim().slice(0, 500) || null;

  // Insert tickets one by one to handle the rare race on number collisions; we keep
  // it simple and rely on the unique constraint to guard concurrency.
  const created = await prisma.$transaction(
    numbers.map((n) =>
      prisma.raffleTicket.create({
        data: {
          raffleId: raffle.id,
          userId,
          number: n,
          comment: trimmedComment,
          paypalOrderId: params.paypalOrderId ?? null,
          paypalCaptureId: captureId,
          amountPaid: amountPaidPerTicket,
        },
        include: { user: { select: { slug: true, username: true, imageUrl: true } } },
      }),
    ),
  );

  const newSold = sold + created.length;
  broadcast(raffle.id, {
    type: "ticket_purchased",
    sold: newSold,
    available: Math.max(0, raffle.maxTickets - newSold),
  });

  // max-tickets raffles auto-draw inline once full.
  if (raffle.drawType === "max-tickets" && newSold >= raffle.maxTickets) {
    // Fire-and-forget; errors logged inside.
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
