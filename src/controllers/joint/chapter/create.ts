import { prisma } from '../../../models/prisma';
import { requireJointMember, canUpload } from '../../../util/joint-auth';
import type { CreateJointChapterRequest } from '../../../types/joint/chapter/create';
import { firePublishEffects, resolvePublishAt } from '../../../services/chapter-schedule';

export const createJointChapter = async (
  slug: string,
  organizationId: number,
  params: CreateJointChapterRequest
) => {
  const { joint, member } = await requireJointMember(slug, organizationId);
  // Publicacion programada: fecha futura = invisible hasta esa hora.
  const publishAt = resolvePublishAt(params.publishAt) ?? null;

  if (!canUpload(member)) {
    throw new Error('No tienes permisos para subir capítulos a este joint.');
  }

  // Check chapter number doesn't already exist (active)
  const existing = await prisma.chapter.findFirst({
    where: { jointId: joint.id, number: params.number, deletedAt: null },
  });
  if (existing) throw new Error(`El capítulo ${params.number} ya existe en este joint.`);

  // The (number, jointId) unique constraint is DB-level and doesn't distinguish
  // soft-deleted rows — if a previous chapter with this number was soft-deleted,
  // inserting a new one would fail. Hard-delete stale soft-deleted siblings so
  // re-create after delete works seamlessly.
  const staleDeleted = await prisma.chapter.findMany({
    where: { jointId: joint.id, number: params.number, deletedAt: { not: null } },
    select: { id: true },
  });
  if (staleDeleted.length > 0) {
    const ids = staleDeleted.map(s => s.id);
    await prisma.page.deleteMany({ where: { chapterId: { in: ids } } });
    await prisma.userChapterHistory.deleteMany({ where: { chapterId: { in: ids } } });
    await prisma.viewsHistory.deleteMany({ where: { chapterId: { in: ids } } });
    await prisma.chapter.deleteMany({ where: { id: { in: ids } } });
  }

  const r2PublicUrl = Bun.env.R2_PUBLIC_URL || 'https://r2.capibaratraductor.com';
  let imageUrl: string | null = null;
  if (params.image && typeof params.image === 'string') {
    imageUrl = params.image.startsWith('http') ? params.image : `${r2PublicUrl}/${params.image}`;
  }

  // Validate workedByOrganizationIds are all ACCEPTED members
  const acceptedMemberIds = joint.members
    .filter((m: any) => m.status === 'ACCEPTED')
    .map((m: any) => m.organizationId);

  const workedByIds = (params.workedByOrganizationIds || []).filter(id =>
    acceptedMemberIds.includes(id)
  );

  const chapter = await prisma.chapter.create({
    data: {
      jointId: joint.id,
      mangaCustomId: null,
      uploadedByOrganizationId: organizationId,
      number: params.number,
      title: params.title || '',
      imageUrl,
      releasedAt: params.isUnreleased ? null : (params.releasedAt ? new Date(params.releasedAt as any) : new Date()),
      isUnreleased: params.isUnreleased ?? false,
      publishAt,
      workedByOrganizations: {
        connect: workedByIds.map(id => ({ id })),
      },
    },
  });

  // Create pages
  if (params.pages && params.pages.length > 0) {
    await Promise.all(
      params.pages.map(async (page, index) => {
        const pageUrl = page.startsWith('http') ? page : `${r2PublicUrl}/${page}`;
        await prisma.page.create({
          data: {
            imageUrl: pageUrl,
            number: index + 1,
            chapterId: chapter.id,
            imageHeight: 100,
            imageWidth: 100,
            imageType: 'any',
            // @ts-ignore
            isSinglePage: params.singlePages?.includes(index) ?? false,
          },
        });
      })
    );
  }

  // Efectos de capitulo nuevo (lastChapterAt, webhooks de Discord de los
  // miembros, notificaciones). Si esta programado, los dispara el cron
  // chapter-scheduled-publish al llegar la hora.
  if (!publishAt) {
    await firePublishEffects(chapter.id);
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
