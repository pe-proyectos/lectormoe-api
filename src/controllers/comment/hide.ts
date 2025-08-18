import { prisma } from "../../models/prisma";

export const hideComment = async (commentId: number, hiddenReason?: string, hiddenByUserId?: number) => {
  const comment = await prisma.comment.findUnique({
    where: {
      id: commentId,
    }
  });

  if (!comment) {
    return false;
  }

  if (comment.hiddenAt) {
    await prisma.comment.update({
      where: {
        id: commentId,
      },
      data: {
        hiddenAt: null,
        hiddenReason: null,
        hiddenByUserId: null,
      }
    });
  } else {
    await prisma.comment.update({
      where: {
        id: commentId,
      },
      data: {
        hiddenAt: new Date(),
        hiddenReason,
        hiddenByUserId,
      }
    });
  }

  return true;
};
