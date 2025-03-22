import { prisma } from "../../models/prisma";

export const listComments = async (
  organizationId: number,
  identifier: string,
  userId?: number
) => {
  return await prisma.comment.findMany({
    where: {
      organizationId,
      identifier,
      parentId: null,
      deletedAt: null
    },
    orderBy: {
      createdAt: 'asc'
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          imageUrl: true
        }
      },
      likes: {
        where: {
          userId
        }
      }
    }
  });
};
