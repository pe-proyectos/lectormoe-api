import { prisma } from '../../../models/prisma';
import { requireJointMember, canUpload } from '../../../util/joint-auth';

export interface DemoteResult {
  success: boolean;
  conflict?: boolean;
  existingChapterId?: number;
  movedToMangaCustomId?: number;
}

// Move a joint-anchored chapter back to its uploader's MangaCustom. The
// uploader's MC must already exist (auto-created on join). On a number
// collision in that MC, the call returns { conflict: true, existingChapterId }
// and does NOT mutate; the FE prompts the user, then re-calls with replace=true.
export const demoteChapterFromJoint = async (
  jointSlug: string,
  callerOrgId: number,
  chapterId: number,
  opts: { replace?: boolean; actorUserId?: number | null } = {},
): Promise<DemoteResult> => {
  const { joint, member } = await requireJointMember(jointSlug, callerOrgId);
  if (!canUpload(member)) throw new Error('No tienes permisos para mover capítulos en este joint.');

  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: {
      id: true, number: true, mangaCustomId: true, jointId: true,
      uploadedByOrganizationId: true, deletedAt: true,
    },
  });
  if (!chapter || chapter.deletedAt) throw new Error('Capítulo no encontrado.');
  if (chapter.jointId !== joint.id) throw new Error('Este capítulo no pertenece a este joint.');
  if (chapter.mangaCustomId) throw new Error('Este capítulo ya está en un MangaCustom.');
  if (!chapter.uploadedByOrganizationId) throw new Error('Este capítulo no tiene uploader registrado.');

  const uploaderOrgId = chapter.uploadedByOrganizationId;
  const isUploader = uploaderOrgId === callerOrgId;
  if (!isUploader && member.role !== 'LEADER') {
    throw new Error('Solo el uploader o el líder pueden mover este capítulo.');
  }

  // Resolve uploader's MangaCustom for this manga (auto-create on miss so we
  // never lose chapters even if the MC was deleted).
  let mc = await prisma.mangaCustom.findFirst({
    where: { organizationId: uploaderOrgId, mangaId: joint.mangaId, deletedAt: null },
    select: { id: true },
  });
  if (!mc) {
    const softDeleted = await prisma.mangaCustom.findFirst({
      where: { organizationId: uploaderOrgId, mangaId: joint.mangaId, deletedAt: { not: null } },
      select: { id: true },
    });
    if (softDeleted) {
      mc = await prisma.mangaCustom.update({
        where: { id: softDeleted.id },
        data: { deletedAt: null },
        select: { id: true },
      });
    } else {
      const baseManga = await prisma.manga.findUnique({
        where: { id: joint.mangaId },
        select: { title: true, imageUrl: true, bannerUrl: true, shortDescription: true, description: true },
      });
      mc = await prisma.mangaCustom.create({
        data: {
          mangaId: joint.mangaId,
          organizationId: uploaderOrgId,
          title: baseManga?.title || 'Sin título',
          imageUrl: baseManga?.imageUrl ?? null,
          bannerUrl: baseManga?.bannerUrl ?? null,
          shortDescription: baseManga?.shortDescription ?? null,
          description: baseManga?.description ?? null,
        },
        select: { id: true },
      });
    }
  }

  const collision = await prisma.chapter.findFirst({
    where: { mangaCustomId: mc.id, number: chapter.number, deletedAt: null, NOT: { id: chapter.id } },
    select: { id: true },
  });

  if (collision && !opts.replace) {
    return { success: false, conflict: true, existingChapterId: collision.id };
  }

  if (collision && opts.replace) {
    // Re-point user history rows that point to the loser → survivor (this chapter).
    const survivorHistory = await prisma.userChapterHistory.findMany({
      where: { chapterId: chapter.id },
      select: { userId: true },
    });
    const userIdsWithSurvivor = new Set(survivorHistory.map(h => h.userId));
    const loserHistory = await prisma.userChapterHistory.findMany({
      where: { chapterId: collision.id },
      select: { id: true, userId: true },
    });
    const movableHistoryIds = loserHistory.filter(h => !userIdsWithSurvivor.has(h.userId)).map(h => h.id);
    if (movableHistoryIds.length > 0) {
      await prisma.userChapterHistory.updateMany({
        where: { id: { in: movableHistoryIds } },
        data: { chapterId: chapter.id },
      });
    }
    const droppedIds = loserHistory.filter(h => userIdsWithSurvivor.has(h.userId)).map(h => h.id);
    if (droppedIds.length > 0) {
      await prisma.userChapterHistory.deleteMany({ where: { id: { in: droppedIds } } });
    }
    await prisma.chapter.update({
      where: { id: collision.id },
      data: { deletedAt: new Date() },
    });
  }

  await prisma.chapter.update({
    where: { id: chapter.id },
    data: { jointId: null, mangaCustomId: mc.id },
  });

  await prisma.audit.create({
    data: {
      action: 'chapter_demote',
      payload: {
        chapterId, jointId: joint.id, toMangaCustomId: mc.id,
        number: chapter.number, replacedExistingId: opts.replace ? collision?.id ?? null : null,
      },
      ip: 'system',
      userId: opts.actorUserId ?? null,
      organizationId: callerOrgId,
    },
  });

  return { success: true, movedToMangaCustomId: mc.id };
};
