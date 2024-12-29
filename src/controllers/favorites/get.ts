import { prisma } from "../../models/prisma";

export const getFavorite = async (organizationId: number, userId: number, mangaSlug: string) => {
	const favorite = await prisma.favorite.findFirst({
		where: {
			userId,
			mangaCustom: {
				organizationId,
				manga: {
					slug: mangaSlug,
				}
			}
		},
	});

	return !!favorite;
};
