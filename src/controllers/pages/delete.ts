import { prisma } from "../../models/prisma";

export const deletePage = async (organizationId: number, mangaSlug: string, chapterNumber: number, pageId: number) => {
    await prisma.page.delete({
        where: {
            id: pageId,
            chapter: {
                number: chapterNumber,
                mangaCustom: {
                    manga: {
                        slug: mangaSlug,
                    },
                    organization: {
                        id: organizationId,
                    }
                }
            }
        }
    });
};
