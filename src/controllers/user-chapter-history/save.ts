import { prisma } from "../../models/prisma";

export const saveUserChapterHistory = async (organizationId: number, userId: number, mangaSlug: string, chapterNumber: number, pageNumber: number) => {
    const chapter = await prisma.chapter.findFirst({
        select: {
            id: true,
            pages: {
                orderBy: {
                    number: 'desc',
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
        return null;
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

    const isLastPage = chapter.pages.length > 0 && (pageNumber === chapter.pages[0].number);

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

    if (isLastPage) {
        const nextChapters = await prisma.chapter.findMany({
            where: {
                mangaCustom: {
                    organization: {
                        id: organizationId,
                    },
                    manga: {
                        slug: mangaSlug,
                    }
                },
                number: {
                    gt: chapterNumber,
                },
            },
            orderBy: {
                number: 'asc',
            },
            take: 1,
        });

        if (nextChapters.length > 0) {
            await prisma.userChapterHistory.upsert({
                where: {
                    chapterId_userId: {
                        chapterId: nextChapters[0].id,
                        userId,
                    }
                },
                update: {},
                create: {
                    userId,
                    chapterId: nextChapters[0].id,
                    pageNumber: 1,
                    lastReadAt: new Date(),
                },
            });
        }
    }

    return true;
}
