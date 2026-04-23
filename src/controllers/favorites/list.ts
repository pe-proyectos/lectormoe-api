import { prisma, Prisma } from "../../models/prisma";
import type { FavoritesListQuery } from "../../types/favorites/list";

const CHAPTER_SELECT = {
	id: true,
	number: true,
	title: true,
	releasedAt: true,
};

const FAVORITE_INCLUDE = {
	mangaCustom: {
		select: {
			id: true,
			title: true,
			imageUrl: true,
			status: true,
			isNSFW: true,
			organization: {
				select: {
					id: true,
					name: true,
					slug: true,
					isNSFW: true,
				},
			},
			manga: {
				select: { slug: true },
			},
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

export const listFavorites = async (organizationId: number | null, userId: number, filters: FavoritesListQuery) => {
	// organizationId filter only applies to mangaCustom favorites, not joints.
	// When present, we OR with jointId so the user's joint favorites stay visible.
	const whereClause: any = organizationId !== null
		? {
			userId,
			OR: [
				{ mangaCustom: { organizationId } },
				{ jointId: { not: null } },
			],
		}
		: { userId };

	const limit = Number.parseInt(filters?.limit || "10");
	const page = Number.parseInt(filters?.page || "1");

	const favoriteData = await prisma.favorite.findMany({
		where: whereClause,
		include: FAVORITE_INCLUDE,
		orderBy: [
			{ order: Prisma.SortOrder.asc },
			{ createdAt: Prisma.SortOrder.desc },
		],
		skip: filters?.page ? (page - 1) * limit : 0,
		take: limit,
	});

	const total = await prisma.favorite.count({ where: whereClause });

	return {
		data: favoriteData,
		maxPage: Math.ceil(total / limit),
		total,
	};
};
