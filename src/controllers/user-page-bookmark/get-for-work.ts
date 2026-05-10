import { prisma } from '../../models/prisma';

const CHAPTER_SELECT = {
  id: true,
  number: true,
  title: true,
  mangaCustomId: true,
  jointId: true,
  mangaCustom: {
    select: {
      id: true,
      title: true,
      organization: { select: { slug: true } },
      manga: { select: { slug: true, bookType: { select: { code: true } } } },
    },
  },
  joint: { select: { id: true, slug: true, title: true } },
};

export const getBookmarkForMangaCustom = async (userId: number, mangaCustomId: number) => {
  const bookmark = await prisma.userPageBookmark.findFirst({
    where: { userId, chapter: { mangaCustomId } },
    include: { chapter: { select: CHAPTER_SELECT } },
    orderBy: { updatedAt: 'desc' },
  });
  return bookmark;
};

export const getBookmarkForJoint = async (userId: number, jointId: number) => {
  const bookmark = await prisma.userPageBookmark.findFirst({
    where: { userId, chapter: { jointId } },
    include: { chapter: { select: CHAPTER_SELECT } },
    orderBy: { updatedAt: 'desc' },
  });
  return bookmark;
};
