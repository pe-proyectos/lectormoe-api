import { prisma } from "../../models/prisma";
import { EditCommentRequest } from "../../types/comment/edit";

export const editComment = async (commentId: number, params: EditCommentRequest) => {
  const comment = await prisma.comment.update({
    where: {
      id: commentId,
    },
    data: {
      comment: params.comment,
    }
  });

  return !!comment;
};
