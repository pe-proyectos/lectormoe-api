import { prisma } from "../../models/prisma";

export const createViewHistoryJoint = async (
  jointSlug: string,
  ip: string
) => {
  const joint = await prisma.mangaJoint.findFirst({
    where: { slug: jointSlug, deletedAt: null },
  });

  if (!joint) return null;

  const twentyMinutesAgo = new Date();
  twentyMinutesAgo.setMinutes(twentyMinutesAgo.getMinutes() - 20);

  await prisma.$transaction(async (tx) => {
    const existingView = await tx.viewsHistory.findFirst({
      where: {
        ip,
        jointId: joint.id,
        chapterId: null,
        viewedAt: { gte: twentyMinutesAgo },
      },
    });

    await tx.viewsHistory.create({
      data: {
        ip,
        viewedAt: new Date(),
        jointId: joint.id,
      },
    });

    if (!existingView) {
      // No per-joint view counter on MangaJoint model, but we still record for AdSense distribution
    }
  });

  return true;
};

export const createViewHistoryJointChapter = async (
  jointSlug: string,
  chapterNumber: number,
  ip: string
) => {
  const joint = await prisma.mangaJoint.findFirst({
    where: { slug: jointSlug, deletedAt: null },
  });

  if (!joint) return null;

  const chapter = await prisma.chapter.findFirst({
    where: {
      jointId: joint.id,
      number: chapterNumber,
      deletedAt: null,
    },
  });

  if (!chapter) return null;

  const twentyMinutesAgo = new Date();
  twentyMinutesAgo.setMinutes(twentyMinutesAgo.getMinutes() - 20);

  await prisma.$transaction(async (tx) => {
    const existingView = await tx.viewsHistory.findFirst({
      where: {
        ip,
        chapterId: chapter.id,
        jointId: joint.id,
        viewedAt: { gte: twentyMinutesAgo },
      },
    });

    await tx.viewsHistory.create({
      data: {
        ip,
        viewedAt: new Date(),
        chapterId: chapter.id,
        jointId: joint.id,
      },
    });

    if (!existingView) {
      await tx.chapter.update({
        where: { id: chapter.id },
        data: { views: { increment: 1 } },
      });
    }
  });

  return true;
};
