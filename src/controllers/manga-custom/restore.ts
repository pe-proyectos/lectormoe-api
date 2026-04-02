import { prisma } from "../../models/prisma";

export const restoreMangaCustom = async (organizationId: number, mangaSlug: string) => {
	const mangaCustom = await prisma.mangaCustom.findFirst({
		where: {
			organizationId,
			manga: {
				slug: mangaSlug,
			},
			deletedAt: { not: null },
		},
	});

	if (!mangaCustom) {
		throw new Error("No se encontró el manga eliminado");
	}

	await prisma.mangaCustom.update({
		where: {
			id: mangaCustom.id,
		},
		data: {
			deletedAt: null,
		},
	});
};
