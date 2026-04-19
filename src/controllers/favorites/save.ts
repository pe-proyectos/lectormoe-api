import { prisma } from "../../models/prisma";

const FREE_FAVORITES_LIMIT = 50;

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

    // Gratis: 50. Suscriptores activos: ilimitado.
    const hasActiveSubscription = await prisma.subscription.findFirst({
        where: { userId, active: true },
        select: { id: true },
    });

    if (!hasActiveSubscription) {
        const currentCount = await prisma.favorite.count({ where: { userId } });
        if (currentCount >= FREE_FAVORITES_LIMIT) {
            throw new Error(
                `Has alcanzado el límite de ${FREE_FAVORITES_LIMIT} favoritos del plan gratuito. Suscríbete para tener favoritos ilimitados.`
            );
        }
    }

    await prisma.favorite.create({
        data: { userId, mangaCustomId: manga.id },
    });

    return true;
};
