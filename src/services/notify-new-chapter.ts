import { prisma } from '../models/prisma';

// Fan-out for a freshly created chapter. Inserts one Notification row per
// distinct user that has the manga (or joint) in their favorites or user-list.
// "favorite" wins over "user_list" when the user has both. Fire-and-forget —
// callers should not await this in the request path.
export const notifyNewChapter = async (params: {
  chapterId: number;
  mangaCustomId?: number | null;
  jointId?: number | null;
}) => {
  const { chapterId, mangaCustomId, jointId } = params;
  if (!mangaCustomId && !jointId) return;

  // Collect (userId, source) pairs. Favorite wins over user_list when both.
  const sourceByUser = new Map<number, 'favorite' | 'user_list'>();

  if (mangaCustomId) {
    const ulRows = await prisma.userList.findMany({
      where: { mangaCustomId },
      select: { userId: true },
    });
    for (const r of ulRows) sourceByUser.set(r.userId, 'user_list');
    const favRows = await prisma.favorite.findMany({
      where: { mangaCustomId },
      select: { userId: true },
    });
    for (const r of favRows) sourceByUser.set(r.userId, 'favorite');
  }
  if (jointId) {
    const ulRows = await prisma.userList.findMany({
      where: { jointId },
      select: { userId: true },
    });
    for (const r of ulRows) sourceByUser.set(r.userId, 'user_list');
    const favRows = await prisma.favorite.findMany({
      where: { jointId },
      select: { userId: true },
    });
    for (const r of favRows) sourceByUser.set(r.userId, 'favorite');
  }

  if (sourceByUser.size === 0) return;

  await prisma.notification.createMany({
    data: [...sourceByUser.entries()].map(([userId, source]) => ({
      userId,
      type: 'new_chapter',
      mangaCustomId: mangaCustomId ?? null,
      jointId: jointId ?? null,
      chapterId,
      source,
    })),
    skipDuplicates: true,
  });
};
