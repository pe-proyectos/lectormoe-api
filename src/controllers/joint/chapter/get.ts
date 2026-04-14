import { prisma } from '../../../models/prisma';

export const getJointChapter = async (slug: string, chapterNumber: number) => {
  const joint = await prisma.mangaJoint.findFirst({
    where: { slug, deletedAt: null },
  });
  if (!joint) throw new Error('Joint no encontrado.');

  const chapter = await prisma.chapter.findFirst({
    where: { jointId: joint.id, number: chapterNumber, deletedAt: null },
    include: {
      pages: { orderBy: { number: 'asc' } },
      uploadedByOrganization: { select: { id: true, name: true, slug: true, logoUrl: true } },
      workedByOrganizations: { select: { id: true, name: true, slug: true, logoUrl: true } },
    },
  });
  if (!chapter) throw new Error('Capítulo no encontrado.');

  // Adjacent chapters for reader navigation
  const [prev, next] = await Promise.all([
    prisma.chapter.findFirst({
      where: { jointId: joint.id, number: { lt: chapterNumber }, deletedAt: null },
      orderBy: { number: 'desc' },
      select: { number: true },
    }),
    prisma.chapter.findFirst({
      where: { jointId: joint.id, number: { gt: chapterNumber }, deletedAt: null },
      orderBy: { number: 'asc' },
      select: { number: true },
    }),
  ]);

  return { chapter, prevChapter: prev, nextChapter: next, joint };
};
