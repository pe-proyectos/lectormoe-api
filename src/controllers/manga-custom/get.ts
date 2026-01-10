import { prisma, Prisma } from "../../models/prisma";

export const getMangaCustomBySlug = async (organizationId: number, mangaSlug: string) => {
	const mangaCustom = await prisma.mangaCustom.findFirst({
		where: {
			organization: {
				id: organizationId,
			},
			manga: {
				slug: mangaSlug,
			},
		},
		include: {
			manga: {
				include: {
					authors: true,
					demography: true,
					bookType: true,
				}
			},
			chapters: {
				orderBy: {
					number: Prisma.SortOrder.desc,
				},
			},
			genres: {
				select: {
					id: true,
					name: true,
					description: true,
					slug: true,
				},
			},
			subscriptionPlans: {
				select: {
					id: true,
					name: true,
					canDownload: true,
					canReadUnreleased: true,
				},
			},
			rankings: {
				take: 4,
				select: {
					rank: true,
					comment: true,
					createdAt: true,
					User: {
						select: {
							username: true,
						},
					},
				},
				orderBy: {
					createdAt: Prisma.SortOrder.desc,
				},
			},
		},
	});
	if (!mangaCustom) {
		return null;
	}
	return mangaCustom;
};
