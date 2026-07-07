import { prisma } from '../../models/prisma'
import {
  getSiblingChapterIds,
  resolveChapterAndBase
} from '../../services/chapter-siblings'

// Guarda el progreso (página actual) de un capítulo. Fan-out: aplica a todas
// las versiones del capítulo de la obra base para sincronizar entre scans.
export const saveUserChapterHistory = async (
  organizationId: number | null,
  userId: number,
  mangaSlug: string,
  chapterNumber: number,
  pageNumber: number
) => {
  const resolved = await resolveChapterAndBase(
    organizationId,
    mangaSlug,
    chapterNumber
  )
  if (!resolved) return false

  const { baseMangaId, chapter } = resolved
  const lastPageNumber = chapter.pages[0]?.number
  // Sin páginas (novela): se considera en progreso; el "terminado" lo dispara
  // el frontend con el endpoint de marcar capítulo (save-chapter).
  const isLastPage =
    lastPageNumber != null ? pageNumber === lastPageNumber : false

  const siblingIds = await getSiblingChapterIds(baseMangaId, chapterNumber)
  const now = new Date()

  // No degradar capítulos ya terminados en ninguna versión.
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

  // Al terminar, abrir el siguiente capítulo de la obra base (en todos sus siblings).
  if (isLastPage) {
    const nextChapter = await prisma.chapter.findFirst({
      where: {
        number: { gt: chapterNumber },
        deletedAt: null,
        OR: [
          { mangaCustom: { mangaId: baseMangaId, deletedAt: null } },
          { joint: { mangaId: baseMangaId, deletedAt: null } }
        ]
      },
      orderBy: { number: 'asc' },
      select: { number: true }
    })
    if (nextChapter) {
      const nextSiblings = await getSiblingChapterIds(
        baseMangaId,
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
