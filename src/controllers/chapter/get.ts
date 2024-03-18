import { prisma } from "../../models/prisma";

export const getChapter = async (organizationId: number, mangaSlug: string, number: number) => {
	const chapter = await prisma.chapter.findFirst({
		where: {
			number,
			mangaCustom: {
				manga: {
					slug: mangaSlug
				},
				organization: {
					id: organizationId
				}
			}
		}
	});
	if (!chapter) {
		return null;
	}	
	return chapter;
};
