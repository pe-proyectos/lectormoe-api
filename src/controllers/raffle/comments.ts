import { prisma } from "../../models/prisma";
import { sanitizeMarkdownInput } from "../../services/markdown-pipeline";
import { broadcast } from "../../services/raffle-events";

const COMMENTS_PAGE_DEFAULT = 50;
const COMMENT_MAX_LEN = 500;

export const listRaffleComments = async (slug: string, params: { before?: number; limit?: number }) => {
  const raffle = await prisma.raffle.findUnique({ where: { slug } });
  if (!raffle || raffle.deletedAt) throw new Error("Sorteo no encontrado.");

  const limit = Math.min(100, Math.max(1, params.limit ?? COMMENTS_PAGE_DEFAULT));

  const where: any = { raffleId: raffle.id };
  if (params.before) where.id = { lt: params.before };

  const rows = await prisma.raffleComment.findMany({
    where,
    orderBy: { id: "desc" },
    take: limit,
    include: { user: { select: { id: true, slug: true, username: true, imageUrl: true } } },
  });

  // Resolve which authors have a (non-refunded) ticket in this raffle.
  const userIds = Array.from(new Set(rows.map((r) => r.userId)));
  const ticketHolders = userIds.length === 0
    ? []
    : await prisma.raffleTicket.findMany({
        where: { raffleId: raffle.id, userId: { in: userIds }, refundedAt: null },
        select: { userId: true },
        distinct: ["userId"],
      });
  const holderIds = new Set(ticketHolders.map((t) => t.userId));

  // Reverse so the client gets oldest-first for chronological display.
  return rows.reverse().map((c) => ({
    id: c.id,
    userId: c.userId,
    userSlug: c.user.slug,
    userUsername: c.user.username,
    userImageUrl: c.user.imageUrl,
    isTicketHolder: holderIds.has(c.userId),
    body: c.body,
    createdAt: c.createdAt,
  }));
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

  const isTicketHolder = (await prisma.raffleTicket.count({
    where: { raffleId: raffle.id, userId, refundedAt: null },
  })) > 0;

  const payload = {
    id: created.id,
    userId: created.userId,
    userSlug: created.user.slug,
    userUsername: created.user.username,
    userImageUrl: created.user.imageUrl,
    isTicketHolder,
    body: created.body,
    createdAt: created.createdAt.toISOString(),
  };

  broadcast(raffle.id, { type: "comment", comment: payload });
  return payload;
};
