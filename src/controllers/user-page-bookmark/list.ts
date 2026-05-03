import { prisma } from '../../models/prisma';

export const listPageBookmarks = async (userId: number) => {
  return prisma.userPageBookmark.findMany({
    where: { userId },
    orderBy: { order: 'asc' },
    include: {
      chapter: {
        select: {
          id: true,
          number: true,
          title: true,
          imageUrl: true,
          mangaCustomId: true,
          jointId: true,
          mangaCustom: {
            select: {
              id: true,
              title: true,
              imageUrl: true,
              organization: { select: { slug: true } },
              manga: { select: { slug: true } },
            },
          },
          joint: {
            select: {
              id: true,
              slug: true,
              title: true,
              imageUrl: true,
            },
          },
        },
      },
    },
  });
};
