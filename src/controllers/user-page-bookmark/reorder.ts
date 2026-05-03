import { prisma } from '../../models/prisma';

export const reorderPageBookmarks = async (userId: number, orderedIds: number[]) => {
  await Promise.all(
    orderedIds.map((id, index) =>
      prisma.userPageBookmark.updateMany({
        where: { id, userId },
        data: { order: index },
      })
    )
  );
  return true;
};
