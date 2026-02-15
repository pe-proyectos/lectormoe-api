import { prisma } from "../../models/prisma";

const FREE_FAVORITES_LIMIT = 50;
const SUBSCRIBER_FAVORITES_LIMIT = 100;

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

    // Check favorites limit
    const [currentCount, hasActiveSubscription] = await Promise.all([
        prisma.favorite.count({ where: { userId } }),
        prisma.subscription.findFirst({
            where: { userId, active: true },
            select: { id: true },
        }),
    ]);

    const limit = hasActiveSubscription ? SUBSCRIBER_FAVORITES_LIMIT : FREE_FAVORITES_LIMIT;

    if (currentCount >= limit) {
        throw new Error(
            hasActiveSubscription
                ? `Has alcanzado el limite de ${SUBSCRIBER_FAVORITES_LIMIT} favoritos.`
                : `Has alcanzado el limite de ${FREE_FAVORITES_LIMIT} favoritos. Suscribete para tener hasta ${SUBSCRIBER_FAVORITES_LIMIT}.`
        );
    }

    await prisma.favorite.create({
        data: {
            userId,
            mangaCustomId: manga.id,
        }
    });

    return true;
};
