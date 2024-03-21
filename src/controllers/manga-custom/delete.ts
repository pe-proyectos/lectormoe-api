import { prisma } from "../../models/prisma";

export const deleteMangaCustom = async (organizationId: number, mangaSlug: string) => {
	const mangaCustom = await prisma.mangaCustom.findFirst({
		where: {
			organizationId,
			manga: {
				slug: mangaSlug,
			},
		},
	});

	if (!mangaCustom) {
		throw new Error(`Tu organización no tiene este manga`);
	}
	
	await prisma.page.deleteMany({
		where: {
			chapter: {
				mangaCustomId: mangaCustom.id,
			},
		},
	});
	await prisma.chapter.deleteMany({
		where: {
			mangaCustomId: mangaCustom.id,
		},
	});
	await prisma.mangaCustom.delete({
		where: {
			id: mangaCustom.id,
		},
	});
};
