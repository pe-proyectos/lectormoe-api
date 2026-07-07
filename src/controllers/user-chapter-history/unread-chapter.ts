import { prisma } from '../../models/prisma'
import {
  getSiblingChapterIds,
  resolveChapterAndBase
} from '../../services/chapter-siblings'

// Desmarca un capítulo como leído en TODAS sus versiones (fan-out multi-scan).
export const unreadUserChapterHistoryChapter = async (
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

  const siblingIds = await getSiblingChapterIds(
    resolved.baseMangaId,
    chapterNumber
  )
  await prisma.userChapterHistory.deleteMany({
    where: { userId, chapterId: { in: siblingIds } }
  })

  return true
}
