import { prisma, Prisma } from "../../models/prisma";

export const listPages = async (organizationId: number, mangaSlug: string, chapterNumber: number) => {
	const pages = await prisma.page.findMany({
		orderBy: {
			number: Prisma.SortOrder.asc,
		},
		where: {
			chapter: {
				number: chapterNumber,
				mangaCustom: {
					manga: {
						slug: mangaSlug
					},
					organization: {
						id: organizationId
					}
				}
			}
		}
	});

	return pages;
};
