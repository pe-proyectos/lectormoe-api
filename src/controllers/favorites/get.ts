import { prisma } from "../../models/prisma";

export const getFavorite = async (organizationId: number | null, userId: number, mangaSlug: string) => {
	// Construir el where según si tenemos organizationId o no
	const whereClause: any = {
		manga: {
			slug: mangaSlug,
		}
	};

	// Si hay organizationId, filtrar por esa organización
	// Si no hay, buscar el primer manga que coincida (de cualquier organización)
	if (organizationId !== null) {
		whereClause.organizationId = organizationId;
	}

	// Primero buscar el MangaCustom que coincida
	const mangaCustom = await prisma.mangaCustom.findFirst({
		where: whereClause
	});

	if (!mangaCustom) {
		return false;
	}

	// Luego buscar el favorito usando el mangaCustomId
	const favorite = await prisma.favorite.findFirst({
		where: {
			userId,
			mangaCustomId: mangaCustom.id,
		},
	});

	return !!favorite;
};
