import { prisma } from "../../models/prisma";

export const deleteChapter = async (organizationId: number, mangaSlug: string, number: number) => {
	const chapter = await prisma.chapter.findFirst({
		where: {
			number,
			deletedAt: null,
			mangaCustom: {
				manga: { slug: mangaSlug },
				organization: { id: organizationId },
			},
		},
	});
	if (!chapter) {
		return null;
	}
	await prisma.chapter.update({
		where: { id: chapter.id },
		data: { deletedAt: new Date() },
	});
	return chapter;
};
