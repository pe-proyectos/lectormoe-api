import { prisma, Prisma } from "../../models/prisma";
import type { FavoritesListQuery } from "../../types/favorites/list";

export const listFavorites = async (organizationId: number | null, userId: number, filters: FavoritesListQuery) => {
	const whereClause: any = {
		userId,
		mangaCustom: {
			...(organizationId !== null ? { organizationId } : {}),
		},
	};

	const favoriteData = await prisma.favorite.findMany({
		where: whereClause,
		include: {
			mangaCustom: {
				select: {
					id: true,
					title: true,
					imageUrl: true,
					status: true,
					organization: {
						select: {
							id: true,
							name: true,
							slug: true,
						}
					},
					manga: {
						select: {
							slug: true,
						}
					},
					chapters: {
						select: {
							id: true,
							number: true,
							title: true,
							releasedAt: true,
							subscribersOnly: true,
						},
						orderBy: {
							releasedAt: Prisma.SortOrder.desc,
						},
						take: 2,
					}
				}
			}
		},
		orderBy: {
			createdAt: Prisma.SortOrder.desc,
		},
		skip: filters?.page ? (Number.parseInt(filters?.page || "1") - 1) * Number.parseInt(filters?.limit || "10") : 0,
		take: Number.parseInt(filters?.limit || "10"),
	});

	const total = await prisma.favorite.count({
		where: whereClause,
	});

	return {
		data: favoriteData,
		maxPage: Math.ceil(total / Number.parseInt(filters?.limit || "10")),
		total,
	}
};
