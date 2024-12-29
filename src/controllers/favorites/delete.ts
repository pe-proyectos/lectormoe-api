import { prisma } from "../../models/prisma";

export const deleteFavorite = async (organizationId: number, userId: number, mangaSlug: string) => {
    const existingFavorite = await prisma.favorite.findFirst({
        where: {
            userId,
            mangaCustom: {
                organizationId,
                manga: {
                    slug: mangaSlug,
                }
            }
        }
    });

    if (!existingFavorite) {
        return false;
    }

    await prisma.favorite.delete({
        where: {
            id: existingFavorite.id,
        }
    });

    return true;
};
