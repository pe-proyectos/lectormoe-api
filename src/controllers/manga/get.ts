import prisma from "../../models/prisma";

export const getMangaBySlug = async (manga_slug: string) => {
	const manga = await prisma.manga.findFirst({
		where: {
			slug: manga_slug,
		},
		include: {
			chapters: {
				orderBy: {
					number: "desc",
				},
			},
			author: {
				select: {
					name: true,
					slug: true,
				},
			},
			demography: {
				select: {
					name: true,
					slug: true,
					description: true,
				},
			},
			genres: {
				select: {
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
					created_at: true,
					user: {
						select: {
							username: true,
						},
					},
				},
				orderBy: {
					created_at: "desc",
				},
			},
		},
	});
	return manga;
};
