import { prisma } from "../../models/prisma";

export const saveUserChapterHistory = async (organizationId: number, userId: number, mangaSlug: string, chapterNumber: number, pageNumber: number) => {
    const chapter = await prisma.chapter.findFirst({
        select: {
            id: true,
            pages: {
                orderBy: {
                    number: 'desc',
                },
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
    console.log({ pageNumber });
    console.log("chapter.pages.length", chapter.pages.length);
    console.log("chapter.pages");
    console.log(chapter.pages);
    
    const isLastPage = chapter.pages.length > 0 && (pageNumber === chapter.pages[chapter.pages.length - 1].number);
    console.log("isLastPage ", isLastPage);
    

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
