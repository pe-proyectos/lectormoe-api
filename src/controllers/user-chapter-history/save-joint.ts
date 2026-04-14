import { prisma, Prisma } from "../../models/prisma";

export const saveJointUserChapterHistory = async (
  userId: number,
  jointSlug: string,
  chapterNumber: number,
  pageNumber: number
) => {
  const joint = await prisma.mangaJoint.findFirst({
    where: { slug: jointSlug, deletedAt: null },
  });

  if (!joint) return false;

  const chapter = await prisma.chapter.findFirst({
    select: {
      id: true,
      pages: {
        orderBy: { number: Prisma.SortOrder.desc },
        take: 1,
        select: { number: true },
      },
    },
    where: {
      jointId: joint.id,
      number: chapterNumber,
      deletedAt: null,
    },
  });

  if (!chapter) return false;

  const existingHistory = await prisma.userChapterHistory.findFirst({
    where: {
      chapterId: chapter.id,
      userId,
      finishedAt: { not: null },
    },
  });

  if (existingHistory) return false;

  const isLastPage = chapter.pages.length > 0 && pageNumber === chapter.pages[0].number;

  await prisma.userChapterHistory.upsert({
    where: { chapterId_userId: { chapterId: chapter.id, userId } },
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
    const nextChapter = await prisma.chapter.findFirst({
      where: {
        jointId: joint.id,
        number: { gt: chapterNumber },
        deletedAt: null,
      },
      orderBy: { number: Prisma.SortOrder.asc },
      take: 1,
    });

    if (nextChapter) {
      await prisma.userChapterHistory.upsert({
        where: { chapterId_userId: { chapterId: nextChapter.id, userId } },
        update: {},
        create: {
          userId,
          chapterId: nextChapter.id,
          pageNumber: 1,
          lastReadAt: new Date(),
        },
      });
    }
  }

  return true;
};
