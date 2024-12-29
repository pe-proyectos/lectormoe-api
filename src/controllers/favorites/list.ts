import { prisma } from "../../models/prisma";
import type { FavoritesListQuery } from "../../types/favorites/list";

export const listFavorites = async (organizationId: number, userId: number, filters: FavoritesListQuery) => {
	const favoriteData = await prisma.favorite.findMany({
		where: {
			userId,
			mangaCustom: {
				organizationId,
			},
		},
		include: {
			mangaCustom: {
				select: {
					title: true,
					imageUrl: true,
					manga: {
						select: {
							slug: true,
						}
					}
				}
			}
		},
		orderBy: {
			createdAt: 'desc',
		},
		skip: filters?.page ? (Number.parseInt(filters?.page || "1") - 1) * Number.parseInt(filters?.limit || "10") : 0,
		take: Number.parseInt(filters?.limit || "10"),
	});

	const total = await prisma.favorite.count({
		where: {
			userId,
		},
	});

	return {
		data: favoriteData,
		maxPage: Math.ceil(total / Number.parseInt(filters?.limit || "10")),
		total,
	}
};
