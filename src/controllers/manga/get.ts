import { prisma } from "../../models/prisma";

export const getMangaBySlug = async (mangaSlug: string) => {
	const manga = await prisma.manga.findFirst({
		where: {
			slug: mangaSlug,
		},
		include: {
			chapters: {
				orderBy: {
					number: "desc",
				},
			},
			authors: {
				select: {
					id: true,
					name: true,
					slug: true,
				},
			},
			demography: {
				select: {
					id: true,
					name: true,
					slug: true,
					description: true,
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
	return manga;
};
