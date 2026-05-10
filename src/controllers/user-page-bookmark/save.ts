import { prisma } from '../../models/prisma';

/**
 * Save a bookmark for a position in a chapter. Each user can have AT MOST ONE
 * bookmark per work (mangaCustom or joint) — saving a new one automatically
 * replaces any previous bookmark on the same work.
 *
 * `pageNumber` semantics depend on the work type:
 *   - manga / image-based: actual page number (1..N)
 *   - novel / writing:     scroll percentage (1..100)
 */
export const savePageBookmark = async (
  userId: number,
  chapterId: number,
  pageNumber: number,
  note?: string,
) => {
  // Find the chapter to identify which work it belongs to.
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: { id: true, mangaCustomId: true, jointId: true, deletedAt: true },
  });
  if (!chapter || chapter.deletedAt) throw new Error('Capítulo no encontrado.');

  // Wipe any previous bookmark this user has on the same work — there can be
  // only one. We scope by mangaCustomId OR jointId depending on what the
  // chapter belongs to.
  if (chapter.mangaCustomId) {
    await prisma.userPageBookmark.deleteMany({
      where: { userId, chapter: { mangaCustomId: chapter.mangaCustomId } },
    });
  } else if (chapter.jointId) {
    await prisma.userPageBookmark.deleteMany({
      where: { userId, chapter: { jointId: chapter.jointId } },
    });
  }

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

  return { action: 'saved', bookmark };
};
