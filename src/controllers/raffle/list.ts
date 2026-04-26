import { prisma } from "../../models/prisma";
import { resolveR2Url } from "../../util/r2-url";

const PAGE_LIMIT_DEFAULT = 24;

export const listRaffles = async (params: {
  status?: "active" | "completed" | "all";
  page?: number;
  limit?: number;
  includeDeleted?: boolean;
}) => {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? PAGE_LIMIT_DEFAULT));

  let statusFilter: any;
  if (params.status === "active") {
    statusFilter = { in: ["active", "drawing"] };
  } else if (params.status === "completed") {
    statusFilter = { in: ["completed", "cancelled"] };
  } else {
    // 'all' or undefined — everything except deleted unless explicitly requested.
    statusFilter = undefined;
  }

  const where: any = {
    ...(params.includeDeleted ? {} : { deletedAt: null }),
    ...(statusFilter ? { status: statusFilter } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.raffle.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        _count: { select: { tickets: true } },
      },
    }),
    prisma.raffle.count({ where }),
  ]);

  const decorated = await Promise.all(
    items.map(async (r) => {
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
          ticketNumber: ticket ? ticket.number.toString().padStart(5, "0") : null,
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
        imageUrl: resolveR2Url(r.imageUrl),
        bannerUrl: resolveR2Url(r.bannerUrl),
        ticketPrice: r.ticketPrice,
        currency: r.currency,
        minTickets: r.minTickets,
        maxTickets: r.maxTickets,
        maxTicketsPerUser: r.maxTicketsPerUser,
        drawType: r.drawType,
        drawAt: r.drawAt,
        status: r.status,
        cancelReason: r.cancelReason,
        sold: r._count.tickets,
        available: Math.max(0, r.maxTickets - r._count.tickets),
        winner,
        createdAt: r.createdAt,
      };
    }),
  );

  return { items: decorated, total, page, limit };
};
