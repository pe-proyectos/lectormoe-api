import { Prisma, prisma } from '../../models/prisma'
import { getSiblingChapterIds } from '../../services/chapter-siblings'

// Guarda progreso desde un capítulo de joint. Fan-out multi-scan: usa la obra
// base del joint para sincronizar con todas las versiones del capítulo.
export const saveJointUserChapterHistory = async (
  userId: number,
  jointSlug: string,
  chapterNumber: number,
  pageNumber: number
) => {
  const joint = await prisma.mangaJoint.findFirst({
    where: { slug: jointSlug, deletedAt: null },
    select: { id: true, mangaId: true }
  })

  if (!joint) return false

  const chapter = await prisma.chapter.findFirst({
    select: {
      id: true,
      pages: {
        orderBy: { number: Prisma.SortOrder.desc },
        take: 1,
        select: { number: true }
      }
    },
    where: {
      jointId: joint.id,
      number: chapterNumber,
      deletedAt: null
    }
  })

  if (!chapter) return false

  const isLastPage =
    chapter.pages.length > 0 && pageNumber === chapter.pages[0].number
  const siblingIds = await getSiblingChapterIds(joint.mangaId, chapterNumber)
  const now = new Date()

  const alreadyFinished = new Set(
    (
      await prisma.userChapterHistory.findMany({
        where: {
          userId,
          chapterId: { in: siblingIds },
          finishedAt: { not: null }
        },
        select: { chapterId: true }
      })
    ).map((h) => h.chapterId)
  )

  const toUpsert = siblingIds.filter((id) => !alreadyFinished.has(id))
  if (toUpsert.length > 0) {
    await prisma.$transaction(
      toUpsert.map((chapterId) =>
        prisma.userChapterHistory.upsert({
          where: { chapterId_userId: { chapterId, userId } },
          update: {
            pageNumber,
            lastReadAt: now,
            finishedAt: isLastPage ? now : null
          },
          create: {
            userId,
            chapterId,
            pageNumber,
            lastReadAt: now,
            finishedAt: isLastPage ? now : null
          }
        })
      )
    )
  }

  if (isLastPage) {
    const nextChapter = await prisma.chapter.findFirst({
      where: {
        number: { gt: chapterNumber },
        deletedAt: null,
        OR: [
          { mangaCustom: { mangaId: joint.mangaId, deletedAt: null } },
          { joint: { mangaId: joint.mangaId, deletedAt: null } }
        ]
      },
      orderBy: { number: Prisma.SortOrder.asc },
      select: { number: true }
    })

    if (nextChapter) {
      const nextSiblings = await getSiblingChapterIds(
        joint.mangaId,
        nextChapter.number
      )
      await prisma.$transaction(
        nextSiblings.map((chapterId) =>
          prisma.userChapterHistory.upsert({
            where: { chapterId_userId: { chapterId, userId } },
            update: {},
            create: { userId, chapterId, pageNumber: 1, lastReadAt: now }
          })
        )
      )
    }
  }

  return true
}
