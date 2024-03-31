import { prisma } from "../../models/prisma";

export const saveUserChapterHistory = async (organizationId: number, userId: number, mangaSlug: string, chapterNumber: number, pageNumber: number) => {
    const chapter = await prisma.chapter.findFirst({
        select: {
            id: true,
            pages: {
                select: {
                    number: true,
                }
            },
        },
        where: {
            mangaCustom: {
                organization: {
                    id: organizationId,
                },
                manga: {
                    slug: mangaSlug,
                }
            },
            number: chapterNumber,
        },
    });

    if (!chapter) {
        return null;
    }

    const isLastPage = chapter.pages.length > 0 && (pageNumber === chapter.pages[chapter.pages.length - 1].number);

    await prisma.userChapterHistory.upsert({
        where: {
            chapterId_userId: {
                chapterId: chapter.id,
                userId,
            }
        },
        update: {
            pageNumber,
            lastReadAt: new Date(),
            finishedAt: isLastPage ? new Date() : null,
        },
        create: {
            userId,
            chapterId: chapter.id,
            pageNumber,
            lastReadAt: new Date(),
        },
    });

    return true;
}
