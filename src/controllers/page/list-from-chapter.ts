import { prisma } from "../../models/prisma";

export const listFromChapter = async (manga_slug: string, chapter_slug: string) => {
	const manga = await prisma.manga.findFirst({
		where: {
			slug: manga_slug,
		},
		include: {
			chapters: true,
		}
	});
	if (!manga) {
		return null;
	}
	const pages = await prisma.page.findMany({
		where: {
			chapter: {
				slug: chapter_slug,
				manga_id: manga.id,
			}
		},
		orderBy: {
			number: "asc",
		}
	});
	return pages;
};
