import { prisma } from "../../models/prisma";

export const deletePage = async (userId: number, organizationSlug: string, mangaSlug: string, chapterNumber: number, pageId: number) => {
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
                        slug: organizationSlug,
                        members: {
                            some: {
                                userId
                            }
                        }
                    }
                }
            }
        }
    });
};
