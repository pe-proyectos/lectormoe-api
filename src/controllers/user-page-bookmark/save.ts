import { prisma } from '../../models/prisma';

const FREE_BOOKMARK_LIMIT = 5;

async function enforceLimit(userId: number) {
  const hasSub = await prisma.subscription.findFirst({
    where: { userId, active: true },
    select: { id: true },
  });
  if (!hasSub) {
    const count = await prisma.userPageBookmark.count({ where: { userId } });
    if (count >= FREE_BOOKMARK_LIMIT) {
      throw new Error(`Límite de ${FREE_BOOKMARK_LIMIT} marcadores alcanzado. Suscríbete para marcadores ilimitados.`);
    }
  }
}

export const savePageBookmark = async (userId: number, chapterId: number, pageNumber: number, note?: string) => {
  const existing = await prisma.userPageBookmark.findUnique({
    where: { userId_chapterId_pageNumber: { userId, chapterId, pageNumber } },
  });

  if (existing) {
    await prisma.userPageBookmark.delete({ where: { id: existing.id } });
    return { action: 'removed', id: existing.id };
  }

  await enforceLimit(userId);

  const maxOrder = await prisma.userPageBookmark.aggregate({
    where: { userId },
    _max: { order: true },
  });

  const bookmark = await prisma.userPageBookmark.create({
    data: {
      userId,
      chapterId,
      pageNumber,
      note,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  return { action: 'added', bookmark };
};
