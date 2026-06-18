import { prisma } from "../../models/prisma";
import { CreateCommentRequest } from "../../types/comment/create";
import { uploadFile } from "../../util/upload-file";
import { notifyComment } from "../../services/notify-new-chapter";
import { getActiveBan } from "./ban-user";
import { BanType } from "../../prisma-generated/enums";

export const createComment = async (organizationId: number, userId: number, params: CreateCommentRequest) => {
  const activeBan = await getActiveBan(userId, organizationId);
  if (activeBan) {
    const banLabel = activeBan.type === BanType.TEMPORARY ? "temporalmente baneado" :
      activeBan.type === BanType.RESTRICTED ? "restringido" : "baneado permanentemente";
    throw new Error(`No puedes comentar: estás ${banLabel} en este scan.${activeBan.reason ? ` Motivo: ${activeBan.reason}` : ""}`);
  }

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
			const r2PublicUrl = Bun.env.R2_PUBLIC_URL || 'https://r2.capibaratraductor.com';
			const imageUrl = params.image.startsWith('http') 
				? params.image 
				: `${r2PublicUrl}/${params.image}`;
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

  // Fire-and-forget fan-out: reply notification (delayed-email) for the parent
  // author and in-app notifications for content owners. Runs for every comment.
  notifyComment(comment.id).catch(console.error);

  return !!comment;
};
