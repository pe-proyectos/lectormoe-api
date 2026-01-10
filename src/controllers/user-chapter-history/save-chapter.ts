import { prisma, Prisma } from "../../models/prisma";

export const saveUserChapterHistoryChapter = async (organizationId: number, userId: number, mangaSlug: string, chapterNumber: number) => {
    const chapter = await prisma.chapter.findFirst({
        select: {
            id: true,
            pages: {
                orderBy: {
                    number: Prisma.SortOrder.desc,
                },
                take: 1,
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
        return false;
    }


    const existingHistory = await prisma.userChapterHistory.findFirst({
        where: {
            chapterId: chapter.id,
            userId,
            finishedAt: {
                not: null,
            },
        }
    });

    if (existingHistory) {
        // we don't update the history if the user has already finished the chapter
        return null;
    }

    const page = chapter.pages[chapter.pages.length - 1];

    if (!page) {
        return true;
    }

    await prisma.userChapterHistory.upsert({
        where: {
            chapterId_userId: {
                chapterId: chapter.id,
                userId,
            }
        },
        update: {
            pageNumber: page.number,
            lastReadAt: new Date(),
            finishedAt: new Date(),
        },
        create: {
            userId,
            chapterId: chapter.id,
            pageNumber: page.number,
            lastReadAt: new Date(),
            finishedAt: new Date(),
        },
    });

    return true;
}
