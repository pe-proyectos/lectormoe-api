import { prisma } from '../../../models/prisma';
import { requireJointMember } from '../../../util/joint-auth';

// Reassign uploadedByOrganizationId on a chapter to another ACCEPTED member.
// This is destructive in the sense that future detach flows will treat the
// chapter as belonging to the new org. Caller must be the current uploader OR
// the LEADER (override).
export const transferChapterAuthorship = async (
  jointSlug: string,
  callerOrgId: number,
  chapterId: number,
  toOrganizationId: number,
  actorUserId?: number | null,
) => {
  const { joint, member } = await requireJointMember(jointSlug, callerOrgId);

  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: { id: true, jointId: true, uploadedByOrganizationId: true, deletedAt: true, number: true },
  });
  if (!chapter || chapter.deletedAt) throw new Error('Capítulo no encontrado.');
  if (chapter.jointId !== joint.id) throw new Error('Este capítulo no pertenece a este joint.');

  const isUploader = chapter.uploadedByOrganizationId === callerOrgId;
  if (!isUploader && member.role !== 'LEADER') {
    throw new Error('Solo el uploader o el líder pueden transferir la autoría.');
  }

  if (toOrganizationId === chapter.uploadedByOrganizationId) {
    throw new Error('La autoría ya pertenece a esa organización.');
  }

  const target = await prisma.jointMember.findUnique({
    where: { jointId_organizationId: { jointId: joint.id, organizationId: toOrganizationId } },
    select: { status: true },
  });
  if (!target || target.status !== 'ACCEPTED') {
    throw new Error('La organización destino no es miembro activo del joint.');
  }

  const before = chapter.uploadedByOrganizationId;
  await prisma.chapter.update({
    where: { id: chapter.id },
    data: { uploadedByOrganizationId: toOrganizationId },
  });

  await prisma.audit.create({
    data: {
      action: 'transfer_authorship',
      payload: {
        chapterId, jointId: joint.id, number: chapter.number,
        beforeOrgId: before, afterOrgId: toOrganizationId,
      },
      ip: 'system',
      userId: actorUserId ?? null,
      organizationId: callerOrgId,
    },
  });

  return { success: true, beforeOrgId: before, afterOrgId: toOrganizationId };
};
