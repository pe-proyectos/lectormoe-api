import { prisma } from "../../models/prisma";
import { sanitizeMarkdownInput } from "../../services/markdown-pipeline";
import { broadcast } from "../../services/raffle-events";

const COMMENTS_PAGE_DEFAULT = 50;
const COMMENT_MAX_LEN = 500;

// Per-user ticket buckets used by the chat badge:
//   ticketCount       — total non-refunded tickets the user holds
//   aliveTicketCount  — subset that haven't been eliminated (still in the draw)
//
// The FE renders "N 🎟️" when alive == total (no losses yet) and
// "alive/total 🎟️" once any of the user's tickets have been eliminated, so
// a viewer can see at a glance whether a chatter still has skin in the game.
const fetchTicketBuckets = async (raffleId: number, userIds: number[]) => {
  if (userIds.length === 0) {
    return { totalByUser: new Map<number, number>(), aliveByUser: new Map<number, number>() };
  }
  const [totals, alive] = await Promise.all([
    prisma.raffleTicket.groupBy({
      by: ["userId"],
      where: { raffleId, userId: { in: userIds }, refundedAt: null },
      _count: { _all: true },
    }),
    prisma.raffleTicket.groupBy({
      by: ["userId"],
      where: { raffleId, userId: { in: userIds }, refundedAt: null, eliminatedAt: null },
      _count: { _all: true },
    }),
  ]);
  return {
    totalByUser: new Map<number, number>(totals.map((t) => [t.userId, t._count._all])),
    aliveByUser: new Map<number, number>(alive.map((t) => [t.userId, t._count._all])),
  };
};

export const listRaffleComments = async (slug: string, params: { before?: number; after?: number; limit?: number }) => {
  const raffle = await prisma.raffle.findUnique({ where: { slug } });
  if (!raffle || raffle.deletedAt) throw new Error("Sorteo no encontrado.");

  const limit = Math.min(100, Math.max(1, params.limit ?? COMMENTS_PAGE_DEFAULT));

  const where: any = { raffleId: raffle.id };
  if (params.before) where.id = { lt: params.before };
  // 'after' supports the FE polling loop — fetches only newer comments since the
  // last id the client saw. When set, we order ascending and skip the reverse.
  if (params.after) where.id = { gt: params.after };

  const rows = await prisma.raffleComment.findMany({
    where,
    orderBy: { id: params.after ? "asc" : "desc" },
    take: limit,
    include: { user: { select: { id: true, slug: true, username: true, imageUrl: true } } },
  });

  const userIds = Array.from(new Set(rows.map((r) => r.userId)));
  const { totalByUser, aliveByUser } = await fetchTicketBuckets(raffle.id, userIds);

  const ordered = params.after ? rows : rows.reverse();
  return ordered.map((c) => {
    const ticketCount = totalByUser.get(c.userId) ?? 0;
    const aliveTicketCount = aliveByUser.get(c.userId) ?? 0;
    return {
      id: c.id,
      userId: c.userId,
      userSlug: c.user.slug,
      userUsername: c.user.username,
      userImageUrl: c.user.imageUrl,
      isTicketHolder: ticketCount > 0,
      ticketCount,
      aliveTicketCount,
      body: c.body,
      createdAt: c.createdAt,
    };
  });
};

export const createRaffleComment = async (slug: string, userId: number, rawBody: string) => {
  const raffle = await prisma.raffle.findUnique({ where: { slug } });
  if (!raffle || raffle.deletedAt) throw new Error("Sorteo no encontrado.");

  const sanitized = sanitizeMarkdownInput(rawBody ?? "");
  if (!sanitized) throw new Error("El comentario está vacío.");
  const body = sanitized.slice(0, COMMENT_MAX_LEN);

  const created = await prisma.raffleComment.create({
    data: { raffleId: raffle.id, userId, body },
    include: { user: { select: { id: true, slug: true, username: true, imageUrl: true } } },
  });

  const { totalByUser, aliveByUser } = await fetchTicketBuckets(raffle.id, [userId]);
  const ticketCount = totalByUser.get(userId) ?? 0;
  const aliveTicketCount = aliveByUser.get(userId) ?? 0;

  const payload = {
    id: created.id,
    userId: created.userId,
    userSlug: created.user.slug,
    userUsername: created.user.username,
    userImageUrl: created.user.imageUrl,
    isTicketHolder: ticketCount > 0,
    ticketCount,
    aliveTicketCount,
    body: created.body,
    createdAt: created.createdAt.toISOString(),
  };

  broadcast(raffle.id, { type: "comment", comment: payload });
  return payload;
};
