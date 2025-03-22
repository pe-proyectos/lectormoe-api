import { prisma } from "../../models/prisma";

export const likeComment = async (
  organizationId: number,
  userId: number,
  commentId: number,
  like: boolean
) => {
  // Check if user already liked/disliked this comment
  const existingLike = await prisma.commentLike.findUnique({
    where: {
      commentId_userId_organizationId: {
        commentId,
        userId,
        organizationId,
      },
    },
  });

  if (existingLike) {
    if (existingLike.like === like) {
      // Remove like/dislike if clicking same button
      await prisma.commentLike.delete({
        where: {
          id: existingLike.id,
        },
      });
    } else {
      // Switch from like to dislike or vice versa
      await prisma.commentLike.update({
        where: { id: existingLike.id },
        data: { like },
      });
    }
  } else {
    // Create new like/dislike
    await prisma.commentLike.create({
      data: {
        commentId,
        userId,
        organizationId,
        like,
      },
    });
  }

  // recount likes and dislikes
  const updatedComment = await prisma.comment.update({
    where: { id: commentId },
    data: {
      likesCount: await prisma.commentLike.count({
        where: { commentId, like: true },
      }),
      dislikesCount: await prisma.commentLike.count({
        where: { commentId, like: false },
      }),
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          imageUrl: true,
        },
      },
      likes: {
        where: {
          userId,
        },
      },
    },
  });
  return updatedComment;
};
