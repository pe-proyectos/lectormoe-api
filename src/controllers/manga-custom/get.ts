import { prisma } from "../../models/prisma";

export const getMangaCustomBySlug = async (organizationSlug: string, mangaSlug: string) => {
	const mangaCustom = await prisma.mangaCustom.findFirst({
		where: {
			organization: {
				slug: organizationSlug,
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
			rankings: {
				take: 4,
				select: {
					rank: true,
					comment: true,
					createdAt: true,
					user: {
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
		manga: undefined,
	}
	delete result.manga;
	return result;
};
