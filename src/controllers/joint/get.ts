import { prisma } from '../../models/prisma';

const MEMBER_SELECT = {
  id: true,
  role: true,
  status: true,
  canEditJoint: true,
  canInvite: true,
  canExpel: true,
  invitedAt: true,
  respondedAt: true,
  organization: {
    select: { id: true, name: true, slug: true, logoUrl: true, title: true },
  },
};

const CHAPTER_INCLUDE = {
  uploadedByOrganization: {
    select: { id: true, name: true, slug: true, logoUrl: true },
  },
  workedByOrganizations: {
    select: { id: true, name: true, slug: true, logoUrl: true },
  },
  mangaCustom: {
    select: {
      id: true,
      organizationId: true,
      organization: { select: { id: true, name: true, slug: true, logoUrl: true } },
    },
  },
};

// Aggregated joint chapter listing: UNION of joint-anchored chapters + solo
// chapters from each ACCEPTED member's MangaCustom for the same base manga.
// Dedupe by `number`, keeping the most recent (releasedAt then createdAt). Each
// entry tags `source` ('joint' | 'solo') and the uploader org so the FE can
// render a per-chapter badge.
async function loadAggregatedChapters(joint: { id: number; mangaId: number }, acceptedOrgIds: number[]) {
  const [jointChapters, soloChapters] = await Promise.all([
    prisma.chapter.findMany({
      where: { jointId: joint.id, deletedAt: null },
      include: CHAPTER_INCLUDE,
    }),
    acceptedOrgIds.length === 0 ? Promise.resolve([] as any[]) : prisma.chapter.findMany({
      where: {
        deletedAt: null,
        mangaCustom: {
          mangaId: joint.mangaId,
          organizationId: { in: acceptedOrgIds },
          deletedAt: null,
        },
      },
      include: CHAPTER_INCLUDE,
    }),
  ]);

  type Row = (typeof jointChapters)[number] & { __source: 'joint' | 'solo' };
  const all: Row[] = [
    ...jointChapters.map(c => ({ ...c, __source: 'joint' as const })),
    ...soloChapters.map(c => ({ ...c, __source: 'solo' as const })),
  ];

  // Dedupe by `number`: keep max(releasedAt ?? createdAt). Preserves the joint
  // version on ties so collaborative work always wins over a stale solo copy.
  const byNumber = new Map<number, Row>();
  for (const c of all) {
    const tsA = (c.releasedAt ?? c.createdAt).getTime();
    const existing = byNumber.get(c.number);
    if (!existing) {
      byNumber.set(c.number, c);
      continue;
    }
    const tsB = (existing.releasedAt ?? existing.createdAt).getTime();
    if (tsA > tsB || (tsA === tsB && c.__source === 'joint')) {
      byNumber.set(c.number, c);
    }
  }

  return [...byNumber.values()]
    .sort((a, b) => b.number - a.number)
    .map(c => ({
      id: c.id,
      number: c.number,
      title: c.title,
      imageUrl: c.imageUrl,
      releasedAt: c.releasedAt,
      isUnreleased: c.isUnreleased,
      views: c.views,
      createdAt: c.createdAt,
      // Authorship: prefer explicit uploadedByOrganization (set on joint chapters);
      // fall back to the MangaCustom owner for solo chapters that pre-date the joint.
      uploadedByOrganization: c.uploadedByOrganization
        ?? c.mangaCustom?.organization
        ?? null,
      workedByOrganizations: c.workedByOrganizations,
      source: c.__source,
      mangaCustomId: c.mangaCustomId,
      jointId: c.jointId,
    }));
}

export const getJoint = async (slug: string) => {
  const joint = await prisma.mangaJoint.findFirst({
    where: { slug, deletedAt: null },
    include: {
      manga: {
        include: {
          demography: { select: { name: true, slug: true } },
          bookType: { select: { name: true, code: true } },
          authors: { select: { name: true, slug: true } },
        },
      },
      members: { where: { status: 'ACCEPTED' }, select: MEMBER_SELECT },
    },
  });

  if (!joint) throw new Error('Joint no encontrado.');

  const acceptedOrgIds = joint.members.map(m => m.organization.id);
  const chapters = await loadAggregatedChapters(joint, acceptedOrgIds);

  return { ...joint, chapters };
};

export const getJointForAdmin = async (slug: string) => {
  const joint = await prisma.mangaJoint.findFirst({
    where: { slug, deletedAt: null },
    include: {
      manga: {
        include: {
          demography: { select: { name: true, slug: true } },
          bookType: { select: { name: true, code: true } },
          authors: { select: { name: true, slug: true } },
        },
      },
      members: { select: MEMBER_SELECT },
    },
  });

  if (!joint) throw new Error('Joint no encontrado.');

  const acceptedOrgIds = joint.members
    .filter(m => m.status === 'ACCEPTED')
    .map(m => m.organization.id);
  const chapters = await loadAggregatedChapters(joint, acceptedOrgIds);

  return { ...joint, chapters };
};
