import { prisma } from "../../models/prisma";

export const listPages = async (organizationId: number, mangaSlug: string, chapterNumber: number) => {
	const pages = await prisma.page.findMany({
		orderBy: {
			number: 'asc',
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
