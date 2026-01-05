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
		if (params.image instanceof File) {
			const imageBuffer = await params.image.arrayBuffer();
			const imageUrl = await uploadFile(imageBuffer, params.image.name, undefined, organizationId, 'comments');
			await prisma.comment.update({
				where: {
					id: comment.id,
				},
				data: {
					imageUrl,
				},
			});
		} else if (typeof params.image === 'string') {
			const publicEndpoint = Bun.env.FILE_DOWNLOAD_ENDPOINT 
				|| `https://pub-${Bun.env.R2_ACCOUNT_ID}.r2.dev`;
			const imageUrl = params.image.startsWith('http') 
				? params.image 
				: `${publicEndpoint}/${params.image}`;
			await prisma.comment.update({
				where: {
					id: comment.id,
				},
				data: {
					imageUrl,
				},
			});
		}
	}

  return !!comment;
};
