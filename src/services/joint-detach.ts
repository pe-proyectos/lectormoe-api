import { prisma } from '../models/prisma';

export type DetachOptions = { actorUserId?: number | null; reason?: string };

export interface DetachResult {
  moved: number;
  conflicts: number;
  created: { mangaCustomId: number } | null;
}

// Picks a slug that is not already used by `organizationId` for any of its
// MangaCustoms (active or soft-deleted). The unique constraint on MangaCustom is
// (mangaId, organizationId) so slug collision is per-org, not per-manga.
async function pickAvailableSlug(organizationId: number, baseSlug: string): Promise<string> {
  let candidate = baseSlug;
  let i = 2;
  while (true) {
    const collision = await prisma.mangaCustom.findFirst({
      where: { organizationId, manga: { slug: candidate } },
      select: { id: true },
    });
    if (!collision) return candidate;
    candidate = `${baseSlug}-${i}`;
    i += 1;
    if (i > 50) throw new Error(`No se pudo generar slug para MangaCustom (org=${organizationId}, base=${baseSlug})`);
  }
}

// Find or auto-create the MangaCustom for (organizationId, mangaId). Auto-created
// MCs copy title/imageUrl/etc. from the canonical Manga and use sane defaults.
async function ensureMangaCustom(organizationId: number, mangaId: number): Promise<{ id: number; created: boolean }> {
  const existing = await prisma.mangaCustom.findFirst({
    where: { organizationId, mangaId, deletedAt: null },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };

  // It's possible a soft-deleted MC exists. Restore it (clearing deletedAt) instead
  // of creating a fresh one — this preserves chapter history that pointed to it.
  const softDeleted = await prisma.mangaCustom.findFirst({
    where: { organizationId, mangaId, deletedAt: { not: null } },
    select: { id: true },
  });
  if (softDeleted) {
    await prisma.mangaCustom.update({
      where: { id: softDeleted.id },
      data: { deletedAt: null },
    });
    return { id: softDeleted.id, created: false };
  }

  const manga = await prisma.manga.findUnique({
    where: { id: mangaId },
    select: { title: true, slug: true, shortDescription: true, description: true, imageUrl: true, bannerUrl: true },
  });
  if (!manga) throw new Error(`Manga ${mangaId} no encontrado al crear MangaCustom`);

  await pickAvailableSlug(organizationId, manga.slug);

  const mc = await prisma.mangaCustom.create({
    data: {
      mangaId,
      organizationId,
      title: manga.title,
      shortDescription: manga.shortDescription ?? null,
      description: manga.description ?? null,
      imageUrl: manga.imageUrl ?? null,
      bannerUrl: manga.bannerUrl ?? null,
      status: 'ongoing',
      visibility: 'public',
      workType: 'manga',
    },
    select: { id: true },
  });
  return { id: mc.id, created: true };
}

// Single source of truth for "remove an org's chapters from a joint (back to its
// MangaCustom)". Used by leave, expel, dissolve.
export const detachOrgFromJoint = async (
  jointId: number,
  organizationId: number,
  opts?: DetachOptions,
): Promise<DetachResult> => {
  const joint = await prisma.mangaJoint.findUnique({
    where: { id: jointId },
    select: { id: true, mangaId: true, slug: true },
  });
  if (!joint) throw new Error(`Joint ${jointId} no encontrado`);

  const ensured = await ensureMangaCustom(organizationId, joint.mangaId);
  const mcId = ensured.id;

  const chapters = await prisma.chapter.findMany({
    where: { jointId, uploadedByOrganizationId: organizationId, deletedAt: null },
    select: { id: true, number: true, releasedAt: true, createdAt: true, title: true },
  });

  let moved = 0;
  let conflicts = 0;

  for (const ch of chapters) {
    // Conflict: an active chapter with the same number already exists in the
    // target MangaCustom. Resolve by comparing release/created timestamps.
    const collision = await prisma.chapter.findFirst({
      where: { mangaCustomId: mcId, number: ch.number, deletedAt: null, NOT: { id: ch.id } },
      select: { id: true, releasedAt: true, createdAt: true, title: true },
    });

    if (collision) {
      conflicts += 1;
      const mineTs = (ch.releasedAt ?? ch.createdAt).getTime();
      const theirsTs = (collision.releasedAt ?? collision.createdAt).getTime();
      const mineWins = mineTs >= theirsTs;
      const survivorId = mineWins ? ch.id : collision.id;
      const loserId = mineWins ? collision.id : ch.id;

      // Re-point user history rows from loser → survivor before soft-deleting.
      // The unique (chapterId, userId) on UserChapterHistory means we have to
      // skip rows where the user already has a survivor row.
      const survivorHistory = await prisma.userChapterHistory.findMany({
        where: { chapterId: survivorId },
        select: { userId: true },
      });
      const userIdsWithSurvivor = new Set(survivorHistory.map(h => h.userId));
      const loserHistory = await prisma.userChapterHistory.findMany({
        where: { chapterId: loserId },
        select: { id: true, userId: true },
      });
      const movableHistoryIds = loserHistory
        .filter(h => !userIdsWithSurvivor.has(h.userId))
        .map(h => h.id);
      if (movableHistoryIds.length > 0) {
        await prisma.userChapterHistory.updateMany({
          where: { id: { in: movableHistoryIds } },
          data: { chapterId: survivorId },
        });
      }
      // Drop history rows that would have collided with the survivor.
      const droppedIds = loserHistory
        .filter(h => userIdsWithSurvivor.has(h.userId))
        .map(h => h.id);
      if (droppedIds.length > 0) {
        await prisma.userChapterHistory.deleteMany({ where: { id: { in: droppedIds } } });
      }

      await prisma.chapter.update({
        where: { id: loserId },
        data: { deletedAt: new Date() },
      });

      // If the survivor is the joint chapter, finish detaching it now (mineWins).
      if (mineWins) {
        await prisma.chapter.update({
          where: { id: ch.id },
          data: { jointId: null, mangaCustomId: mcId },
        });
        moved += 1;
      }

      await prisma.audit.create({
        data: {
          action: 'detach_conflict',
          payload: {
            jointId,
            organizationId,
            mangaCustomId: mcId,
            chapterNumber: ch.number,
            survivorId,
            loserId,
            mineWins,
            reason: opts?.reason ?? null,
          },
          ip: 'system',
          userId: opts?.actorUserId ?? null,
          organizationId,
        },
      });
      continue;
    }

    await prisma.chapter.update({
      where: { id: ch.id },
      data: { jointId: null, mangaCustomId: mcId },
    });
    moved += 1;

    await prisma.audit.create({
      data: {
        action: 'detach_chapter',
        payload: {
          jointId,
          organizationId,
          mangaCustomId: mcId,
          chapterId: ch.id,
          chapterNumber: ch.number,
          reason: opts?.reason ?? null,
        },
        ip: 'system',
        userId: opts?.actorUserId ?? null,
        organizationId,
      },
    });
  }

  return { moved, conflicts, created: ensured.created ? { mangaCustomId: mcId } : null };
};
