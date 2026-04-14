import { prisma } from '../../../models/prisma';
import { requireJointMember, canEdit } from '../../../util/joint-auth';

export const deleteJointChapter = async (
  slug: string,
  chapterNumber: number,
  organizationId: number
) => {
  const { joint, member } = await requireJointMember(slug, organizationId);

  const chapter = await prisma.chapter.findFirst({
    where: { jointId: joint.id, number: chapterNumber, deletedAt: null },
  });
  if (!chapter) throw new Error('Capítulo no encontrado.');

  const isUploader = chapter.uploadedByOrganizationId === organizationId;
  const hasEditPerm = canEdit(member);
  if (!isUploader && !hasEditPerm) {
    throw new Error('No tienes permisos para eliminar este capítulo.');
  }

  await prisma.chapter.update({
    where: { id: chapter.id },
    data: { deletedAt: new Date() },
  });

  return { success: true };
};
