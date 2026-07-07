import { prisma } from '../models/prisma'

// Devuelve los IDs de TODAS las versiones de un capítulo de la misma obra base:
// las filas de cada MangaCustom (scan) y las de los joints de esa obra.
export async function getSiblingChapterIds(
  baseMangaId: number,
  chapterNumber: number
): Promise<number[]> {
  const chapters = await prisma.chapter.findMany({
    where: {
      number: chapterNumber,
      deletedAt: null,
      OR: [
        { mangaCustom: { mangaId: baseMangaId, deletedAt: null } },
        { joint: { mangaId: baseMangaId, deletedAt: null } }
      ]
    },
    select: { id: true }
  })
  return chapters.map((c) => c.id)
}

// Resuelve un capítulo a su obra base partiendo del slug del manga. Prueba
// primero la versión del scan actual y cae a cualquier scan o joint de la obra.
export async function resolveChapterAndBase(
  organizationId: number | null,
  mangaSlug: string,
  chapterNumber: number
) {
  const manga = await prisma.manga.findUnique({
    where: { slug: mangaSlug },
    select: { id: true }
  })
  if (!manga) return null

  const pageSelect = {
    pages: {
      orderBy: { number: 'desc' as const },
      take: 1,
      select: { number: true }
    }
  }

  // Primero la versión del scan actual (si hay org).
  if (organizationId) {
    const own = await prisma.chapter.findFirst({
      where: {
        number: chapterNumber,
        deletedAt: null,
        mangaCustom: { organizationId, mangaId: manga.id, deletedAt: null }
      },
      select: { id: true, mangaCustomId: true, jointId: true, ...pageSelect }
    })
    if (own) return { baseMangaId: manga.id, chapter: own }
  }

  // Fallback: cualquier scan o joint de la obra.
  const any = await prisma.chapter.findFirst({
    where: {
      number: chapterNumber,
      deletedAt: null,
      OR: [
        { mangaCustom: { mangaId: manga.id, deletedAt: null } },
        { joint: { mangaId: manga.id, deletedAt: null } }
      ]
    },
    select: { id: true, mangaCustomId: true, jointId: true, ...pageSelect }
  })
  if (!any) return null
  return { baseMangaId: manga.id, chapter: any }
}
