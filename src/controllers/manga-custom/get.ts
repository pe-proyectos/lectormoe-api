import { prisma } from "../../models/prisma";

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
					number: "desc",
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
					createdAt: "desc",
				},
			},
		},
	});
	if (!mangaCustom) {
		return null;
	}
	const result = {
		...mangaCustom.manga,
		...mangaCustom,
		// Asegurar que nextChapterAt y nextChapterAtMessage estén incluidos
		nextChapterAt: mangaCustom.nextChapterAt,
		nextChapterAtMessage: mangaCustom.nextChapterAtMessage,
		manga: undefined,
	}
	delete result.manga;
	return result;
};
