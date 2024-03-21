import { prisma } from "../../models/prisma";

export const deleteChapter = async (organizationId: number, mangaSlug: string, number: number) => {
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
	await prisma.page.deleteMany({
		where: {
			chapterId: chapter.id
		}
	});
	await prisma.chapter.delete({
		where: {
			id: chapter.id
		}
	});
	return chapter;
};
