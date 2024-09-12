import { prisma } from "../../models/prisma";

export const createViewHistoryMangaCustom = async (
  organizationId: number,
  mangaSlug: string,
  ip: string
) => {
  const mangaCustom = await prisma.mangaCustom.findFirst({
    where: {
      organization: {
        id: organizationId,
      },
      manga: {
        slug: mangaSlug,
      },
    },
  });

  if (!mangaCustom) {
    return null;
  }

  await prisma.viewsHistory.create({
    data: {
      ip,
      viewedAt: new Date(),
      mangaCustomId: mangaCustom.id,
    },
  });
  const ips = await prisma.viewsHistory.findMany({
    where: {
      ip,
      mangaCustomId: mangaCustom.id,
    },
    take: 2,
  });
  if (ips.length === 1) {
    await prisma.mangaCustom.update({
      where: {
        id: mangaCustom.id,
      },
      data: {
        views: {
          increment: 1,
        },
      },
    });
  }

  return true;
};

export const createViewHistoryChapter = async (
  organizationId: number,
  mangaSlug: string,
  chapterNumber: number,
  ip: string
) => {
  const chapter = await prisma.chapter.findFirst({
    where: {
      mangaCustom: {
        organization: {
          id: organizationId,
        },
        manga: {
          slug: mangaSlug,
        },
      },
      number: chapterNumber,
    },
    include: {
      mangaCustom: true,
    },
  });

  if (!chapter) {
    return null;
  }

  await prisma.viewsHistory.create({
    data: {
      ip,
      viewedAt: new Date(),
      chapterId: chapter.id,
      mangaCustomId: chapter.mangaCustom.id,
    },
  });
  const ips = await prisma.viewsHistory.findMany({
    where: {
      ip,
      chapterId: chapter.id,
      mangaCustomId: chapter.mangaCustom.id,
    },
    take: 2,
  });
  if (ips.length === 1) {
    await Promise.all([
      prisma.mangaCustom.update({
        where: {
          id: chapter.mangaCustom.id,
        },
        data: {
          views: {
            increment: 1,
          },
        },
      }),
      prisma.chapter.update({
        where: {
          id: chapter.id,
        },
        data: {
          views: {
            increment: 1,
          },
        },
      }),
    ]);
  }

  return true;
};
