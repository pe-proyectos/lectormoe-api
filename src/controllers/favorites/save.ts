import { prisma } from "../../models/prisma";

export const saveFavorite = async (organizationId: number | null, userId: number, mangaSlug: string) => {
    const whereClause: any = {
        manga: { slug: mangaSlug },
    };

    if (organizationId !== null) {
        whereClause.organizationId = organizationId;
    }

    const manga = await prisma.mangaCustom.findFirst({
        select: { id: true },
        where: whereClause,
    });

    if (!manga) {
        return false;
    }

    const existingFavorite = await prisma.favorite.findFirst({
        where: { userId, mangaCustomId: manga.id },
    });

    if (existingFavorite) {
        return true;
    }

    await prisma.favorite.create({
        data: { userId, mangaCustomId: manga.id },
    });

    return true;
};
