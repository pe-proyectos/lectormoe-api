import { prisma, Prisma } from "../../models/prisma";

export const getChapter = async (organizationId: number, mangaSlug: string, number: number) => {
	const chapter = await prisma.chapter.findFirst({
		where: {
			number,
			deletedAt: null,
			mangaCustom: {
				manga: { slug: mangaSlug },
				organization: { id: organizationId },
				deletedAt: null,
			},
		},
	});
	if (!chapter) {
		return null;
	}
	const nextChapter = (await prisma.chapter.findMany({
		where: {
			mangaCustomId: chapter.mangaCustomId,
			deletedAt: null,
			number: { gt: number },
		},
		select: {
			number: true,
			title: true,
			releasedAt: true,
		},
		orderBy: {
			number: Prisma.SortOrder.asc,
		},
		take: 1,
	}))?.[0];
	const previousChapter = (await prisma.chapter.findMany({
		where: {
			mangaCustomId: chapter.mangaCustomId,
			deletedAt: null,
			number: { lt: number },
		},
		select: {
			number: true,
			title: true,
			releasedAt: true,
		},
		orderBy: {
			number: Prisma.SortOrder.desc,
		},
		take: 1
	}))?.[0];
	return {
		...chapter,
		nextChapter,
		previousChapter,
	};
};
