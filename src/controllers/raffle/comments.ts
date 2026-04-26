import { prisma } from "../../models/prisma";
import { sanitizeMarkdownInput } from "../../services/markdown-pipeline";
import { broadcast } from "../../services/raffle-events";

const COMMENTS_PAGE_DEFAULT = 50;
const COMMENT_MAX_LEN = 500;

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

  // Resolve ticket COUNT (non-refunded) per author so the chat can show the
  // holder badge and total tickets bought.
  const userIds = Array.from(new Set(rows.map((r) => r.userId)));
  const ticketCounts = userIds.length === 0
    ? []
    : await prisma.raffleTicket.groupBy({
        by: ["userId"],
        where: { raffleId: raffle.id, userId: { in: userIds }, refundedAt: null },
        _count: { _all: true },
      });
  const countByUser = new Map<number, number>(ticketCounts.map((t) => [t.userId, t._count._all]));

  const ordered = params.after ? rows : rows.reverse();
  return ordered.map((c) => {
    const ticketCount = countByUser.get(c.userId) ?? 0;
    return {
      id: c.id,
      userId: c.userId,
      userSlug: c.user.slug,
      userUsername: c.user.username,
      userImageUrl: c.user.imageUrl,
      isTicketHolder: ticketCount > 0,
      ticketCount,
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

  const ticketCount = await prisma.raffleTicket.count({
    where: { raffleId: raffle.id, userId, refundedAt: null },
  });

  const payload = {
    id: created.id,
    userId: created.userId,
    userSlug: created.user.slug,
    userUsername: created.user.username,
    userImageUrl: created.user.imageUrl,
    isTicketHolder: ticketCount > 0,
    ticketCount,
    body: created.body,
    createdAt: created.createdAt.toISOString(),
  };

  broadcast(raffle.id, { type: "comment", comment: payload });
  return payload;
};
