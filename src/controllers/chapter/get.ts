import { prisma } from "../../models/prisma";

export const getChapter = async (organizationSlug: string, mangaSlug: string, number: number) => {
	const chapter = await prisma.chapter.findFirst({
		where: {
			number,
			mangaCustom: {
				manga: {
					slug: mangaSlug
				},
				organization: {
					slug: organizationSlug
				}
			}
		}
	});
	if (!chapter) {
		return null;
	}	
	return chapter;
};
