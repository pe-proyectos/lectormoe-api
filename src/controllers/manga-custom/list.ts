import { prisma } from "../../models/prisma";
import { MangaCustomListQuery, OrderEnum } from "../../types/manga-custom/list";

const prepareCustomManga = (mangaCustom: any) => {
	const result = {
		...mangaCustom.manga,
		...mangaCustom,
		lastChapterNumber: mangaCustom.chapters?.[0]?.number,
		manga: undefined,
		chapters: undefined,
	};
	delete result.manga;
	return result;
}

export const listMangaCustom = async (organizationId: number, filters: MangaCustomListQuery) => {
	const order: any = {};
	if (filters.order === OrderEnum.FEATURED) {
		order.orderBy = {
			views: "desc",
		};
	} else if (filters.order === OrderEnum.LATEST) {
		order.orderBy = {
			lastChapterAt: {
				sort: 'desc',
				nulls: 'last',
			}
		};
	} else if (filters.order === OrderEnum.POPULAR) {
		const popularMangasCustoms = await prisma.mangaCustom.findMany({
			where: {
				organization: {
					id: organizationId,
				},
				title: {
					contains: filters.title,
				},
				shortDescription: {
					contains: filters.shortDescription,
				},
				description: {
					contains: filters.description,
				},
			},
			include: {
				manga: true,
				chapters: {
					select: {
						number: true,
					},
					orderBy: {
						number: 'desc',
					},
					take: 1,
				},
				viewsHistory: {
					select: {
						id: true,
					},
					distinct: ['ip'],
					where: {
						createdAt: {
							gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
						}
					}
				},
			},
		});
		const result = popularMangasCustoms.sort((a, b) => b.viewsHistory.length - a.viewsHistory.length).slice(
			filters.page ? (parseInt(filters?.page || "1") - 1) * parseInt(filters?.limit || "10") : 0,
			parseInt(filters?.limit || "10"),
		);
		return result.map(prepareCustomManga);
	}

	const mangasCustoms = await prisma.mangaCustom.findMany({
		where: {
			organization: {
				id: organizationId,
			},
			title: {
				contains: filters.title,
			},
			shortDescription: {
				contains: filters.shortDescription,
			},
			description: {
				contains: filters.description,
			},
		},
		include: {
			manga: true,
			chapters: {
				select: {
					number: true,
				},
				orderBy: {
					number: 'desc',
				},
				take: 1,
			},
		},
		...(order || {}),
		skip: filters.page ? (parseInt(filters?.page || "1") - 1) * parseInt(filters?.limit || "10") : 0,
		take: parseInt(filters?.limit || "10"),
	});

	return mangasCustoms.map(prepareCustomManga);
};
