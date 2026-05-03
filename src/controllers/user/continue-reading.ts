import { prisma } from '../../models/prisma';

export const getContinueReading = async (userId: number) => {
  const listEntries = await prisma.userList.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: 20,
    select: {
      mangaCustomId: true,
      jointId: true,
      mangaCustom: {
        select: {
          id: true,
          title: true,
          imageUrl: true,
          organization: { select: { slug: true } },
          manga: { select: { slug: true } },
          chapters: {
            where: {
              deletedAt: null,
              isUnreleased: false,
              OR: [{ releasedAt: null }, { releasedAt: { lte: new Date() } }],
            },
            orderBy: { number: 'asc' },
            select: { id: true, number: true },
          },
        },
      },
      joint: {
        select: {
          id: true,
          slug: true,
          title: true,
          imageUrl: true,
          chapters: {
            where: {
              deletedAt: null,
              isUnreleased: false,
              OR: [{ releasedAt: null }, { releasedAt: { lte: new Date() } }],
            },
            orderBy: { number: 'asc' },
            select: { id: true, number: true },
          },
        },
      },
    },
  });

  const results: any[] = [];

  for (const entry of listEntries) {
    if (results.length >= 5) break;

    if (entry.mangaCustomId && entry.mangaCustom) {
      const mc = entry.mangaCustom;
      const chapters = mc.chapters;
      if (chapters.length === 0) continue;

      const lastHistory = await prisma.userChapterHistory.findFirst({
        where: {
          userId,
          chapterId: { in: chapters.map((c) => c.id) },
          finishedAt: { not: null },
        },
        orderBy: { finishedAt: 'desc' },
        select: { chapterId: true, finishedAt: true },
      });

      let nextChapter;
      if (!lastHistory) {
        nextChapter = chapters[0];
      } else {
        const lastChapter = chapters.find((c) => c.id === lastHistory.chapterId);
        if (!lastChapter) continue;
        nextChapter = chapters.find((c) => c.number > lastChapter.number);
        if (!nextChapter) continue;
      }

      results.push({
        type: 'mangaCustom',
        mangaCustomId: mc.id,
        title: mc.title,
        imageUrl: mc.imageUrl,
        orgSlug: mc.organization.slug,
        mangaSlug: mc.manga?.slug,
        nextChapterNumber: nextChapter.number,
        lastReadAt: lastHistory?.finishedAt ?? null,
      });
    } else if (entry.jointId && entry.joint) {
      const joint = entry.joint;
      const chapters = joint.chapters;
      if (chapters.length === 0) continue;

      const lastHistory = await prisma.userChapterHistory.findFirst({
        where: {
          userId,
          chapterId: { in: chapters.map((c) => c.id) },
          finishedAt: { not: null },
        },
        orderBy: { finishedAt: 'desc' },
        select: { chapterId: true, finishedAt: true },
      });

      let nextChapter;
      if (!lastHistory) {
        nextChapter = chapters[0];
      } else {
        const lastChapter = chapters.find((c) => c.id === lastHistory.chapterId);
        if (!lastChapter) continue;
        nextChapter = chapters.find((c) => c.number > lastChapter.number);
        if (!nextChapter) continue;
      }

      results.push({
        type: 'joint',
        jointId: joint.id,
        jointSlug: joint.slug,
        title: joint.title,
        imageUrl: joint.imageUrl,
        nextChapterNumber: nextChapter.number,
        lastReadAt: lastHistory?.finishedAt ?? null,
      });
    }
  }

  return results;
};
