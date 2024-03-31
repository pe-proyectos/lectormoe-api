import { prisma } from "../../models/prisma";
import { MangaCustomListQuery, OrderEnum } from "../../types/manga-custom/list";

const prepareCustomManga = (mangaCustom: any) => {
	const result = {
		...mangaCustom.manga,
		...mangaCustom,
		lastChapters: mangaCustom.chapters,
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
					mode: "insensitive"
				},
				shortDescription: {
					contains: filters.shortDescription,
					mode: "insensitive"
				},
				description: {
					contains: filters.description,
					mode: "insensitive"
				},
			},
			include: {
				manga: true,
				chapters: {
					select: {
						number: true,
						createdAt: true,
					},
					orderBy: {
						number: 'desc',
					},
					take: 2,
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
			filters?.page ? (parseInt(filters?.page || "1") - 1) * parseInt(filters?.limit || "10") : 0,
			parseInt(filters?.limit || "10"),
		);
		const data = result.map(prepareCustomManga);
		return {
			data,
			maxPage: Math.ceil(popularMangasCustoms.length / parseInt(filters?.limit || "10")),
			total: popularMangasCustoms.length,
		};
	}

	const mangasCustoms = await prisma.mangaCustom.findMany({
		where: {
			organization: {
				id: organizationId,
			},
			title: {
				contains: filters.title,
				mode: "insensitive"
			},
			shortDescription: {
				contains: filters.shortDescription,
				mode: "insensitive"
			},
			description: {
				contains: filters.description,
				mode: "insensitive"
			},
		},
		include: {
			manga: true,
			chapters: {
				select: {
					number: true,
					createdAt: true,
				},
				orderBy: {
					number: 'desc',
				},
				take: 2,
			},
		},
		...(order || {}),
		skip: filters?.page ? (parseInt(filters?.page || "1") - 1) * parseInt(filters?.limit || "10") : 0,
		take: parseInt(filters?.limit || "10"),
	});

	const total = await prisma.mangaCustom.count({
		where: {
			organization: {
				id: organizationId,
			},
			title: {
				contains: filters.title,
				mode: "insensitive"
			},
			shortDescription: {
				contains: filters.shortDescription,
				mode: "insensitive"
			},
			description: {
				contains: filters.description,
				mode: "insensitive"
			},
		},
	});

	return {
		data: mangasCustoms.map(prepareCustomManga),
		maxPage: Math.ceil(total / parseInt(filters?.limit || "10")),
		total,
	}
};
