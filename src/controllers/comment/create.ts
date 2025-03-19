import { prisma } from "../../models/prisma";
import { CreateCommentRequest } from "../../types/comment/create";

export const createComment = async (organizationId: number, userId: number, params: CreateCommentRequest) => {
  const comment = await prisma.comment.create({
    data: {
      userId,
      organizationId,
      comment: params.comment,
      mangaCustomId: params.mangaCustomId,
      chapterId: params.chapterId,
      pageNumber: params.pageNumber,
      // parentId: params.parentId,
      identifier: params.identifier
    }
  });

  return !!comment;
};
