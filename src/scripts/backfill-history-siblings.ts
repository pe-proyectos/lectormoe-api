// Backfill único: propaga cada fila de UserChapterHistory a las versiones
// hermanas del capítulo (otros scans + joints de la obra base). Solo obras con
// MÚLTIPLES versiones. Usa createMany({ skipDuplicates }) para minimizar
// round-trips a la DB remota (upsert por fila era demasiado lento).
import { prisma } from '../models/prisma'
import { getSiblingChapterIds } from '../services/chapter-siblings'

const multiCustom = await prisma.$queryRawUnsafe<Array<{ mangaId: number }>>(
  `SELECT "mangaId" FROM manga_custom WHERE "deletedAt" IS NULL GROUP BY "mangaId" HAVING COUNT(*) > 1`
)
const jointMangas = await prisma.mangaJoint.findMany({
  where: { deletedAt: null },
  select: { mangaId: true }
})
const baseMangaIds = new Set<number>([
  ...multiCustom.map((r) => r.mangaId),
  ...jointMangas.map((j) => j.mangaId)
])
console.log(`Obras con múltiples versiones: ${baseMangaIds.size}`)
if (baseMangaIds.size === 0) {
  await prisma.$disconnect()
  process.exit(0)
}

const chapters = await prisma.chapter.findMany({
  where: {
    deletedAt: null,
    OR: [
      { mangaCustom: { mangaId: { in: [...baseMangaIds] }, deletedAt: null } },
      { joint: { mangaId: { in: [...baseMangaIds] }, deletedAt: null } }
    ]
  },
  select: {
    id: true,
    number: true,
    mangaCustom: { select: { mangaId: true } },
    joint: { select: { mangaId: true } }
  }
})
const chapterMeta = new Map<number, { number: number; baseMangaId: number }>()
for (const c of chapters) {
  const base = c.mangaCustom?.mangaId ?? c.joint?.mangaId
  if (base) chapterMeta.set(c.id, { number: c.number, baseMangaId: base })
}
const relevantChapterIds = [...chapterMeta.keys()]
console.log(`Capítulos relevantes: ${relevantChapterIds.length}`)

const siblingCache = new Map<string, number[]>()
async function siblingsOf(
  baseMangaId: number,
  number: number
): Promise<number[]> {
  const key = `${baseMangaId}:${number}`
  if (siblingCache.has(key)) return siblingCache.get(key)!
  const ids = await getSiblingChapterIds(baseMangaId, number)
  siblingCache.set(key, ids)
  return ids
}

// Traer TODO el historial relevante y construir las filas a crear en memoria.
type NewRow = {
  userId: number
  chapterId: number
  pageNumber: number
  lastReadAt: Date | null
  finishedAt: Date | null
}
const toCreate: NewRow[] = []
let reviewed = 0
let cursor = 0
for (;;) {
  const rows = await prisma.userChapterHistory.findMany({
    where: { id: { gt: cursor }, chapterId: { in: relevantChapterIds } },
    orderBy: { id: 'asc' },
    take: 2000,
    select: {
      id: true,
      userId: true,
      chapterId: true,
      pageNumber: true,
      lastReadAt: true,
      finishedAt: true
    }
  })
  if (rows.length === 0) break
  cursor = rows[rows.length - 1].id
  for (const row of rows) {
    reviewed++
    const meta = chapterMeta.get(row.chapterId)
    if (!meta) continue
    const siblings = await siblingsOf(meta.baseMangaId, meta.number)
    for (const chapterId of siblings) {
      if (chapterId === row.chapterId) continue
      toCreate.push({
        userId: row.userId,
        chapterId,
        pageNumber: row.pageNumber ?? 1,
        lastReadAt: row.lastReadAt,
        finishedAt: row.finishedAt
      })
    }
  }
  console.log(`[scan] revisadas=${reviewed} candidatas=${toCreate.length}`)
}

// createMany en lotes; skipDuplicates ignora las que ya existen (unique chapterId_userId).
let created = 0
for (let i = 0; i < toCreate.length; i += 1000) {
  const chunk = toCreate.slice(i, i + 1000)
  const res = await prisma.userChapterHistory.createMany({
    data: chunk,
    skipDuplicates: true
  })
  created += res.count
  console.log(
    `[insert] ${i + chunk.length}/${toCreate.length} creadas=${created}`
  )
}

console.log(
  `\n✅ Backfill terminado. Revisadas: ${reviewed}. Candidatas: ${toCreate.length}. Creadas: ${created}.`
)
await prisma.$disconnect()
process.exit(0)
