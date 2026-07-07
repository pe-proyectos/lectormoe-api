import { prisma } from '../../models/prisma'
import {
  getSiblingChapterIds,
  resolveChapterAndBase
} from '../../services/chapter-siblings'

// Marca un capítulo como leído. Fan-out: aplica a TODAS las versiones del
// capítulo (cada scan + joints de la obra base) para que lo leído en un scan
// aparezca leído en los demás.
export const saveUserChapterHistoryChapter = async (
  organizationId: number | null,
  userId: number,
  mangaSlug: string,
  chapterNumber: number
) => {
  const resolved = await resolveChapterAndBase(
    organizationId,
    mangaSlug,
    chapterNumber
  )
  if (!resolved) return false

  const { baseMangaId, chapter } = resolved
  // Novelas y capítulos de texto no tienen filas en Page: se marcan con página 1.
  const finishedPage = chapter.pages[0]?.number ?? 1
  const siblingIds = await getSiblingChapterIds(baseMangaId, chapterNumber)
  const now = new Date()

  // Marcar terminado en todos los siblings (idempotente).
  await prisma.$transaction(
    siblingIds.map((chapterId) =>
      prisma.userChapterHistory.upsert({
        where: { chapterId_userId: { chapterId, userId } },
        update: { pageNumber: finishedPage, lastReadAt: now, finishedAt: now },
        create: {
          userId,
          chapterId,
          pageNumber: finishedPage,
          lastReadAt: now,
          finishedAt: now
        }
      })
    )
  )

  return true
}
