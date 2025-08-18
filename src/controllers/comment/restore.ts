import { prisma } from "../../models/prisma";

export const restoreComment = async (commentId: number) => {
  const comment = await prisma.comment.findUnique({
    where: {
      id: commentId,
    }
  });

  if (!comment) {
    return false;
  }

  if (!comment.hiddenAt) {
    return false; // El comentario no está oculto
  }

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

  return true;
};
