import { prisma } from "../../models/prisma";

export const getChapterBySlug = async (manga_slug: string, chapter_slug: string) => {
	const chapter = await prisma.chapter.findFirst({
		where: {
			slug: chapter_slug,
			manga: {
				slug: manga_slug,
			}
		}
	});
	if (!chapter) {
		return null;
	}	
	return chapter;
};
