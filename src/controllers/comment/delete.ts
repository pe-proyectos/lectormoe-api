import { prisma } from "../../models/prisma";

export const deleteComment = async (commentId: number) => {
  await prisma.comment.update({
    where: {
      id: commentId,
    },
    data: {
      'deletedAt': new Date()
    }
  });
  return true;
};
