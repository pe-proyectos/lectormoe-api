import { prisma } from "../../models/prisma";

export const hideComment = async (commentId: number, hiddenReason?: string) => {
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
      }
    });
  }

  return true;
};
