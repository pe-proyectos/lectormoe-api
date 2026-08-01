import { prisma, Prisma } from "../../models/prisma";

const INCLUDE = {
	mangaCustom: {
		select: {
			id: true,
			title: true,
			imageUrl: true,
			isNSFW: true,
			manga: { select: { slug: true } },
			organization: { select: { slug: true, name: true, isNSFW: true } },
		},
	},
	joint: {
		select: {
			id: true,
			slug: true,
			title: true,
			imageUrl: true,
		},
	},
	chapter: {
		select: {
			id: true,
			number: true,
			title: true,
		},
	},
	comment: {
		select: {
			id: true,
			comment: true,
			identifier: true,
			user: { select: { username: true } },
		},
	},
	parentComment: {
		select: {
			id: true,
			comment: true,
			identifier: true,
		},
	},
	subscription: {
		select: {
			id: true,
			subscriptionPlan: { select: { name: true } },
		},
	},
	organization: {
		select: {
			id: true,
			name: true,
			slug: true,
			isNSFW: true,
		},
	},
};

export interface NotificationListQuery {
	page?: string;
	limit?: string;
	unreadOnly?: string;
}

export const listNotifications = async (userId: number, filters: NotificationListQuery) => {
	const limit = Math.max(1, Math.min(100, Number.parseInt(filters?.limit || "20")));
	const page = Math.max(1, Number.parseInt(filters?.page || "1"));
	const unreadOnly = filters?.unreadOnly === "1" || filters?.unreadOnly === "true";

	const where: Prisma.NotificationWhereInput = { userId };
	if (unreadOnly) where.readAt = null;

	const [items, total, unreadTotal] = await Promise.all([
		prisma.notification.findMany({
			where,
			include: INCLUDE,
			orderBy: { createdAt: Prisma.SortOrder.desc },
			skip: (page - 1) * limit,
			take: limit,
		}),
		prisma.notification.count({ where }),
		prisma.notification.count({ where: { userId, readAt: null } }),
	]);

	return {
		items,
		maxPage: Math.max(1, Math.ceil(total / limit)),
		total,
		unreadTotal,
	};
};
