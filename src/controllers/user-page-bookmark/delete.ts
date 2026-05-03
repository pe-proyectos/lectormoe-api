import { prisma } from '../../models/prisma';

export const deletePageBookmark = async (userId: number, bookmarkId: number) => {
  const bookmark = await prisma.userPageBookmark.findFirst({
    where: { id: bookmarkId, userId },
  });
  if (!bookmark) throw new Error('Marcador no encontrado');
  await prisma.userPageBookmark.delete({ where: { id: bookmarkId } });
  return true;
};
