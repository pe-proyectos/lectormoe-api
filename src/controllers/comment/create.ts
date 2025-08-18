import { prisma } from "../../models/prisma";
import { CreateCommentRequest } from "../../types/comment/create";
import { uploadFile } from "../../util/upload-file";

export const createComment = async (organizationId: number, userId: number, params: CreateCommentRequest) => {
  const comment = await prisma.comment.create({
    data: {
      userId,
      organizationId,
      comment: params.comment,
      parentId: params.parentId ? parseInt(params.parentId.toString()) : null,
      identifier: params.identifier,
    }
  });

	if (params.image) {
		const imageBuffer = await params.image.arrayBuffer();
		const imageUrl = await uploadFile(imageBuffer, params.image.name);
		await prisma.comment.update({
			where: {
				id: comment.id,
			},
			data: {
				imageUrl,
			},
		});
	}

  return !!comment;
};
