import { prisma } from '../../../models/prisma';
import { requireJointMember, canUpload } from '../../../util/joint-auth';

// Move a chapter from a member's MangaCustom (solo) into the joint. Chapter's
// uploadedByOrganizationId is preserved as the authorship trail.
export const promoteChapterToJoint = async (
  jointSlug: string,
  callerOrgId: number,
  chapterId: number,
  actorUserId?: number | null,
) => {
  const { joint, member } = await requireJointMember(jointSlug, callerOrgId);
  if (!canUpload(member)) throw new Error('No tienes permisos para mover capítulos en este joint.');

  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: { id: true, number: true, mangaCustomId: true, jointId: true, uploadedByOrganizationId: true,
      mangaCustom: { select: { mangaId: true, organizationId: true } } },
  });
  if (!chapter) throw new Error('Capítulo no encontrado.');
  if (chapter.jointId) throw new Error('Este capítulo ya está en el joint.');
  if (!chapter.mangaCustomId || !chapter.mangaCustom) throw new Error('Este capítulo no está en un MangaCustom.');
  if (chapter.mangaCustom.mangaId !== joint.mangaId) {
    throw new Error('Este capítulo pertenece a otro manga.');
  }

  // Authorization: must be the uploader OR LEADER override.
  const isUploader = chapter.uploadedByOrganizationId === callerOrgId
    || chapter.mangaCustom.organizationId === callerOrgId;
  if (!isUploader && member.role !== 'LEADER') {
    throw new Error('Solo el uploader o el líder pueden mover este capítulo.');
  }

  const collision = await prisma.chapter.findFirst({
    where: { jointId: joint.id, number: chapter.number, deletedAt: null },
    select: { id: true, uploadedByOrganization: { select: { slug: true, name: true } } },
  });
  if (collision) {
    const orgLabel = collision.uploadedByOrganization?.name || collision.uploadedByOrganization?.slug || 'otra org';
    throw new Error(`El joint ya tiene cap. ${chapter.number} (subido por ${orgLabel}). Coordina antes de mover.`);
  }

  await prisma.chapter.update({
    where: { id: chapter.id },
    data: { jointId: joint.id, mangaCustomId: null },
  });

  await prisma.audit.create({
    data: {
      action: 'chapter_promote',
      payload: { chapterId, jointId: joint.id, fromMangaCustomId: chapter.mangaCustomId, number: chapter.number },
      ip: 'system',
      userId: actorUserId ?? null,
      organizationId: callerOrgId,
    },
  });

  return { success: true };
};
