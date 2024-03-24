import { prisma } from "../../models/prisma";

export const getChapter = async (organizationId: number, mangaSlug: string, number: number) => {
	const chapter = await prisma.chapter.findFirst({
		where: {
			number,
			mangaCustom: {
				manga: {
					slug: mangaSlug
				},
				organization: {
					id: organizationId
				}
			}
		}
	});
	if (!chapter) {
		return null;
	}
	const nextChapter = (await prisma.chapter.findMany({
		where: {
			mangaCustomId: chapter.mangaCustomId,
			number: {
				gt: number
			}
		},
		select: {
			number: true,
			title: true,
		},
		orderBy: {
			number: 'asc'
		},
		take: 1,
	}))?.[0];
	const previousChapter = (await prisma.chapter.findMany({
		where: {
			mangaCustomId: chapter.mangaCustomId,
			number: {
				lt: number
			}
		},
		select: {
			number: true,
			title: true,
		},
		orderBy: {
			number: 'desc'
		},
		take: 1
	}))?.[0];
	return {
		...chapter,
		nextChapter,
		previousChapter,
	};
};
