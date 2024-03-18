import { prisma } from "../../models/prisma";

export const listMangaCustom = async (organizationId: number) => {
	const mangasCustom = await prisma.mangaCustom.findMany({
		where: {
			organization: {
				id: organizationId,
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
