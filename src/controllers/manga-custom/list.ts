import { prisma } from "../../models/prisma";

export const listMangaCustom = async (organizationSlug: string) => {
	const mangasCustom = await prisma.mangaCustom.findMany({
		where: {
			organization: {
				slug: organizationSlug,
			},
		},
		include: {
			manga: {
				include: {
					authors: true,
				}
			},
		}
	});
	return mangasCustom.map((mangaCustom) => {
		const result = {
			...mangaCustom.manga,
			...mangaCustom,
			manga: undefined,
		};
		delete result.manga;
		return result;
	});
};
