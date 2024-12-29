import { prisma } from "../../models/prisma";

export const saveFavorite = async (organizationId: number, userId: number, mangaSlug: string) => {
    const manga = await prisma.mangaCustom.findFirst({
        select: {
            id: true,
        },
        where: {
            organizationId,
            manga: {
                slug: mangaSlug,
            }
        },
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
