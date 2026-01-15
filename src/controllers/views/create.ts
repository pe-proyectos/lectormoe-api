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

  // Verificar si ya existe una lectura reciente (última hora) para esta IP y manga
  // Usar transacción para evitar race conditions y permitir contar más lecturas
  const oneHourAgo = new Date();
  oneHourAgo.setHours(oneHourAgo.getHours() - 1);

  await prisma.$transaction(async (tx) => {
    const existingView = await tx.viewsHistory.findFirst({
      where: {
        ip,
        mangaCustomId: mangaCustom.id,
        viewedAt: {
          gte: oneHourAgo,
        },
      },
    });

    // Solo contar si no hay una lectura reciente
    const shouldCount = !existingView;

    await tx.viewsHistory.create({
      data: {
        ip,
        viewedAt: new Date(),
        mangaCustomId: mangaCustom.id,
      },
    });

    if (shouldCount) {
      await tx.mangaCustom.update({
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

    return shouldCount;
  });

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

  // Verificar si ya existe una lectura reciente (última hora) para esta IP y capítulo
  // Usar transacción para evitar race conditions y permitir contar más lecturas
  const oneHourAgo = new Date();
  oneHourAgo.setHours(oneHourAgo.getHours() - 1);

  await prisma.$transaction(async (tx) => {
    const existingView = await tx.viewsHistory.findFirst({
      where: {
        ip,
        chapterId: chapter.id,
        mangaCustomId: chapter.mangaCustom.id,
        viewedAt: {
          gte: oneHourAgo,
        },
      },
    });

    // Solo contar si no hay una lectura reciente
    const shouldCount = !existingView;

    await tx.viewsHistory.create({
      data: {
        ip,
        viewedAt: new Date(),
        chapterId: chapter.id,
        mangaCustomId: chapter.mangaCustom.id,
      },
    });

    if (shouldCount) {
      await Promise.all([
        tx.mangaCustom.update({
          where: {
            id: chapter.mangaCustom.id,
          },
          data: {
            views: {
              increment: 1,
            },
          },
        }),
        tx.chapter.update({
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
  });

  return true;
};
