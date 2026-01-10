import { prisma, Prisma } from "../../models/prisma";

export const unreadUserChapterHistoryChapter = async (organizationId: number, userId: number, mangaSlug: string, chapterNumber: number) => {
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

    await prisma.userChapterHistory.deleteMany({
        where: {
            chapterId: chapter.id,
            userId,
        }
    });

    return true;
}
