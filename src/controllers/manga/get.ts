import { prisma } from "../../models/prisma";

export const getMangaBySlug = async (mangaSlug: string) => {
	const manga = await prisma.manga.findFirst({
		where: {
			slug: mangaSlug,
		},
		include: {
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
		},
	});
	return manga;
};
