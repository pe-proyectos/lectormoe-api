import { prisma } from "../../models/prisma";

export const saveFavorite = async (organizationId: number | null, userId: number, mangaSlug: string) => {
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

    const manga = await prisma.mangaCustom.findFirst({
        select: {
            id: true,
        },
        where: whereClause,
    });

    if (!manga) {
        return false;
    }

    const existingFavorite = await prisma.favorite.findFirst({
        where: {
            userId,
            mangaCustomId: manga.id,
        }
    });

    if (existingFavorite) {
        return true;
    }

    await prisma.favorite.create({
        data: {
            userId,
            mangaCustomId: manga.id,
        }
    });

    return true;
};
