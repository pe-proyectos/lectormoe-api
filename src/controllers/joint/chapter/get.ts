import { prisma } from '../../../models/prisma';

const CHAPTER_INCLUDE = {
  pages: { orderBy: { number: 'asc' as const } },
  uploadedByOrganization: { select: { id: true, name: true, slug: true, logoUrl: true } },
  workedByOrganizations: { select: { id: true, name: true, slug: true, logoUrl: true } },
  mangaCustom: {
    select: {
      id: true, organizationId: true,
      organization: { select: { id: true, name: true, slug: true, logoUrl: true } },
    },
  },
};

// Aggregated single-chapter resolver: looks up the chapter under the joint AND
// under any ACCEPTED member's MangaCustom. Picks the most recent
// (releasedAt ?? createdAt). If the joint is soft-deleted, falls back to the
// latest still-resolvable solo chapter and signals a redirect to the FE.
export const getJointChapter = async (slug: string, chapterNumber: number) => {
  const joint = await prisma.mangaJoint.findFirst({
    where: { slug },
    include: {
      members: {
        where: { status: 'ACCEPTED' },
        select: { organizationId: true, organization: { select: { slug: true } } },
      },
    },
  });
  if (!joint) throw new Error('Joint no encontrado.');

  // Soft-deleted joint → try to redirect to the most recent solo chapter that
  // still resolves. The joint is gone but a former participant might still
  // host the chapter on their own MC.
  if (joint.deletedAt) {
    const formerMemberOrgIds = (await prisma.jointMember.findMany({
      where: { jointId: joint.id },
      select: { organizationId: true },
    })).map(m => m.organizationId);

    const fallback = await prisma.chapter.findFirst({
      where: {
        deletedAt: null,
        number: chapterNumber,
        mangaCustom: {
          mangaId: joint.mangaId,
          organizationId: { in: formerMemberOrgIds },
          deletedAt: null,
        },
      },
      include: { mangaCustom: { include: { manga: { select: { slug: true } }, organization: { select: { slug: true } } } } },
      orderBy: [{ releasedAt: 'desc' }, { createdAt: 'desc' }],
    });

    if (fallback?.mangaCustom) {
      const orgSlug = fallback.mangaCustom.organization.slug;
      const mangaSlug = fallback.mangaCustom.manga.slug;
      return {
        redirectTo: `/${orgSlug}/manga/${mangaSlug}/chapters/${fallback.number}`,
      } as const;
    }

    throw new Error('Joint no encontrado.');
  }

  const acceptedOrgIds = joint.members.map(m => m.organizationId);

  const [jointChapter, soloChapter] = await Promise.all([
    prisma.chapter.findFirst({
      where: { jointId: joint.id, number: chapterNumber, deletedAt: null },
      include: CHAPTER_INCLUDE,
    }),
    acceptedOrgIds.length === 0 ? Promise.resolve(null) : prisma.chapter.findFirst({
      where: {
        deletedAt: null,
        number: chapterNumber,
        mangaCustom: {
          mangaId: joint.mangaId,
          organizationId: { in: acceptedOrgIds },
          deletedAt: null,
        },
      },
      include: CHAPTER_INCLUDE,
      orderBy: [{ releasedAt: 'desc' }, { createdAt: 'desc' }],
    }),
  ]);

  let chapter: any = null;
  if (jointChapter && soloChapter) {
    const jTs = (jointChapter.releasedAt ?? jointChapter.createdAt).getTime();
    const sTs = (soloChapter.releasedAt ?? soloChapter.createdAt).getTime();
    chapter = jTs >= sTs ? jointChapter : soloChapter;
  } else {
    chapter = jointChapter || soloChapter;
  }

  if (!chapter) throw new Error('Capítulo no encontrado.');

  // Adjacent navigation also uses the UNION view to avoid skipping solo-only
  // numbers between two joint chapters.
  const candidates = await prisma.chapter.findMany({
    where: {
      deletedAt: null,
      OR: [
        { jointId: joint.id },
        ...(acceptedOrgIds.length === 0 ? [] : [{
          mangaCustom: {
            mangaId: joint.mangaId,
            organizationId: { in: acceptedOrgIds },
            deletedAt: null,
          },
        }]),
      ],
    },
    select: { number: true },
  });
  const numbers = [...new Set(candidates.map(c => c.number))].sort((a, b) => a - b);
  const idx = numbers.findIndex(n => n === chapter.number);
  const prevNum = idx > 0 ? numbers[idx - 1] : null;
  const nextNum = idx >= 0 && idx < numbers.length - 1 ? numbers[idx + 1] : null;

  return {
    chapter,
    prevChapter: prevNum !== null ? { number: prevNum } : null,
    nextChapter: nextNum !== null ? { number: nextNum } : null,
    joint,
  };
};
