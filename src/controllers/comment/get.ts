import { prisma } from "../../models/prisma";

export const getComment = async (commentId: number, userId?: number) => {
  return await prisma.comment.findUnique({
    where: {
      id: commentId,
      deletedAt: null
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          imageUrl: true
        }
      },
      ...(userId ? {
        likes: {
          where: {
            userId
          }
        }
      } : {})
    }
  });
};
