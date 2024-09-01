import { prisma } from "../../models/prisma";
import { type MangaCustomListQuery, OrderEnum } from "../../types/manga-custom/list";

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const prepareCustomManga = (mangaCustom: any) => {
	const result = {
		...mangaCustom.manga,
		...mangaCustom,
		lastChapters: mangaCustom.chapters,
		manga: undefined,
		chapters: undefined,
	};
	result.manga = undefined;
	return result;
}

export const listMangaCustom = async (organizationId: number, filters: MangaCustomListQuery) => {
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
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
						releasedAt: true,
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
			filters?.page ? (Number.parseInt(filters?.page || "1") - 1) * Number.parseInt(filters?.limit || "10") : 0,
			Number.parseInt(filters?.limit || "10"),
		);
		const data = result.map(prepareCustomManga);
		return {
			data,
			maxPage: Math.ceil(popularMangasCustoms.length / Number.parseInt(filters?.limit || "10")),
			total: popularMangasCustoms.length,
		};
	}

	if (filters.type) {
		order
	}

	const mangasCustoms = await prisma.mangaCustom.findMany({
		where: {
			...(filters.type ? {
				manga: {
					bookType: {
						code: filters.type
					}
				}
			} : {}),
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
					releasedAt: true,
				},
				orderBy: {
					number: 'desc',
				},
				take: 2,
			},
		},
		...(order || {}),
		skip: filters?.page ? (Number.parseInt(filters?.page || "1") - 1) * Number.parseInt(filters?.limit || "10") : 0,
		take: Number.parseInt(filters?.limit || "10"),
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
		maxPage: Math.ceil(total / Number.parseInt(filters?.limit || "10")),
		total,
	};
};
