import { prisma } from "../../models/prisma";

export const deleteGenre = async (organizationId: number, genreSlug: string) => {
    const existingGenre = await prisma.genre.findFirst({
        where: {
            slug: genreSlug,
            organizationId,
        }
    });

    if (!existingGenre) {
        return false;
    }

    await prisma.genre.delete({
        where: {
            id: existingGenre.id,
        }
    });

    return true;
};
