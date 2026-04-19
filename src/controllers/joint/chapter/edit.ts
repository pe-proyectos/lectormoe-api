import { prisma } from '../../../models/prisma';
import { requireJointMember, canUpload } from '../../../util/joint-auth';
import type { EditJointChapterRequest } from '../../../types/joint/chapter/edit';

export const editJointChapter = async (
  slug: string,
  chapterNumber: number,
  organizationId: number,
  params: EditJointChapterRequest
) => {
  const { joint, member } = await requireJointMember(slug, organizationId);

  const chapter = await prisma.chapter.findFirst({
    where: { jointId: joint.id, number: chapterNumber, deletedAt: null },
  });
  if (!chapter) throw new Error('Capítulo no encontrado.');

  // A joint is a collaborative work — any UPLOADER or LEADER can edit any chapter.
  // Viewers can't edit. (Destructive delete is still restricted in delete.ts.)
  if (!canUpload(member)) {
    throw new Error('No tienes permisos para editar capítulos en este joint.');
  }

  const r2PublicUrl = Bun.env.R2_PUBLIC_URL || 'https://r2.capibaratraductor.com';
  const updateData: any = {};

  if (params.title !== undefined) updateData.title = params.title ?? '';
  if (params.releasedAt !== undefined) updateData.releasedAt = params.releasedAt ? new Date(params.releasedAt as any) : null;
  if (params.isUnreleased !== undefined) updateData.isUnreleased = params.isUnreleased;
  if (params.image !== undefined) {
    updateData.imageUrl = params.image === null
      ? null
      : params.image.startsWith('http') ? params.image : `${r2PublicUrl}/${params.image}`;
  }

  await prisma.chapter.update({ where: { id: chapter.id }, data: updateData });

  if (params.workedByOrganizationIds !== undefined) {
    const acceptedMemberIds = await prisma.jointMember.findMany({
      where: { jointId: joint.id, status: 'ACCEPTED' },
      select: { organizationId: true },
    }).then(ms => ms.map(m => m.organizationId));

    const validIds = params.workedByOrganizationIds.filter(id => acceptedMemberIds.includes(id));

    await prisma.chapter.update({
      where: { id: chapter.id },
      data: {
        workedByOrganizations: { set: validIds.map(id => ({ id })) },
      },
    });
  }

  return prisma.chapter.findFirst({
    where: { id: chapter.id },
    include: {
      pages: { orderBy: { number: 'asc' } },
      uploadedByOrganization: { select: { id: true, name: true, slug: true, logoUrl: true } },
      workedByOrganizations: { select: { id: true, name: true, slug: true, logoUrl: true } },
    },
  });
};
