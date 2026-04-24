import { prisma, Prisma } from "../../models/prisma";

const CHAPTER_SELECT = {
	id: true,
	number: true,
	title: true,
	releasedAt: true,
};

const INCLUDE = {
	mangaCustom: {
		select: {
			id: true,
			title: true,
			imageUrl: true,
			status: true,
			isNSFW: true,
			organization: {
				select: { id: true, name: true, slug: true, isNSFW: true },
			},
			manga: { select: { slug: true } },
			chapters: {
				select: CHAPTER_SELECT,
				orderBy: { releasedAt: Prisma.SortOrder.desc },
				take: 2,
			},
		},
	},
	joint: {
		select: {
			id: true,
			slug: true,
			title: true,
			imageUrl: true,
			chapters: {
				where: { deletedAt: null },
				select: CHAPTER_SELECT,
				orderBy: { releasedAt: Prisma.SortOrder.desc },
				take: 2,
			},
		},
	},
};

export interface UserListQuery {
	page?: string;
	limit?: string;
	search?: string;
	status?: string;        // mangaCustom.status filter
	type?: 'manga' | 'joint'; // restrict to one kind
	scanSlug?: string;      // only mangaCustom items from this scan
	sort?: 'order' | 'recent' | 'title'; // default 'order'
	finished?: 'yes' | 'no'; // only finished / only unread
	favoritesOnly?: boolean;   // only entries the user has also favorited
}

export const listUserList = async (
	organizationId: number | null,
	userId: number,
	filters: UserListQuery,
) => {
	const where: any = { userId };

	// Filter: joint vs manga-custom. Default allows both.
	if (filters?.type === 'joint') {
		where.jointId = { not: null };
	} else if (filters?.type === 'manga') {
		where.mangaCustomId = { not: null };
	} else if (organizationId !== null) {
		// Legacy behavior when an x-organization is provided: scope mangas to that org,
		// but always include joints.
		where.OR = [
			{ mangaCustom: { organizationId } },
			{ jointId: { not: null } },
		];
	}

	// Additional per-kind filters — applied through nested manga/joint conditions.
	// These are AND-ed with whatever type/org constraint is already set.
	const andClauses: any[] = [];

	if (filters?.search?.trim()) {
		const q = filters.search.trim();
		andClauses.push({
			OR: [
				{ mangaCustom: { title: { contains: q, mode: 'insensitive' } } },
				{ joint: { title: { contains: q, mode: 'insensitive' } } },
			],
		});
	}

	if (filters?.status) {
		andClauses.push({
			OR: [
				{ mangaCustom: { status: filters.status } },
				// joints don't expose status consistently — leave them in regardless
				{ jointId: { not: null } },
			],
		});
	}

	if (filters?.scanSlug) {
		andClauses.push({
			mangaCustom: { organization: { slug: filters.scanSlug } },
		});
	}

	if (filters?.finished === 'yes') {
		andClauses.push({ finishedAt: { not: null } });
	} else if (filters?.finished === 'no') {
		andClauses.push({ finishedAt: null });
	}

	if (filters?.favoritesOnly) {
		// Restrict to entries whose (mangaCustomId|jointId) also appears in the user's favorites.
		const favs = await prisma.favorite.findMany({
			where: { userId },
			select: { mangaCustomId: true, jointId: true },
		});
		const favMangaIds = favs.map(f => f.mangaCustomId).filter((x): x is number => x !== null);
		const favJointIds = favs.map(f => f.jointId).filter((x): x is number => x !== null);
		andClauses.push({
			OR: [
				favMangaIds.length > 0 ? { mangaCustomId: { in: favMangaIds } } : { id: -1 },
				favJointIds.length > 0 ? { jointId: { in: favJointIds } } : { id: -1 },
			],
		});
	}

	if (andClauses.length > 0) {
		where.AND = andClauses;
	}

	const limit = Math.max(1, Math.min(100, Number.parseInt(filters?.limit || "10")));
	const page = Math.max(1, Number.parseInt(filters?.page || "1"));

	const sort = filters?.sort ?? 'order';
	const orderBy: Prisma.UserListOrderByWithRelationInput[] = sort === 'recent'
		? [{ createdAt: Prisma.SortOrder.desc }]
		: sort === 'title'
		? [{ mangaCustom: { title: Prisma.SortOrder.asc } }, { joint: { title: Prisma.SortOrder.asc } }]
		: [{ order: Prisma.SortOrder.asc }, { createdAt: Prisma.SortOrder.desc }];

	const items = await prisma.userList.findMany({
		where,
		include: INCLUDE,
		orderBy,
		skip: (page - 1) * limit,
		take: limit,
	});

	const total = await prisma.userList.count({ where });

	return {
		data: items,
		maxPage: Math.max(1, Math.ceil(total / limit)),
		total,
	};
};
