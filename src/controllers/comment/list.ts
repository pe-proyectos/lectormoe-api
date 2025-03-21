import { prisma } from "../../models/prisma";

export const listComments = async (
  organizationId: number,
  identifier: string,
  mangaCustomId?: number,
  chapterId?: number,
) => {
  return await prisma.comment.findMany({
    where: {
      organizationId,
      identifier,
    },
    orderBy: {
      createdAt: 'desc'
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          imageUrl: true
        }
      },
    }
  });
};
