import { prisma } from "../../models/prisma";

export const listPages = async (organizationSlug: string, mangaSlug: string, chapterNumber: number) => {
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
						slug: organizationSlug
					}
				}
			}
		}
	});

	return pages;
};
