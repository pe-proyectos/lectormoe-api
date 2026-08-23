import { Prisma, prisma } from '../../models/prisma'

const WRITING_BOOK_TYPE_CODES = ['novel', 'light-novel', 'book', 'short-story']

type ContentKind = 'manga' | 'writing' | 'all'
type Period = 'day' | 'week' | 'month'

const getBadgeColor = (orgName: string): string => {
  let hash = 0
  for (let i = 0; i < orgName.length; i++) {
    hash = orgName.charCodeAt(i) + ((hash << 5) - hash)
  }
  const colors = [
    'bg-purple-600',
    'bg-blue-600',
    'bg-red-600',
    'bg-green-600',
    'bg-yellow-600',
    'bg-pink-600',
    'bg-indigo-600',
    'bg-orange-600'
  ]
  return colors[Math.abs(hash) % colors.length]
}

const periodStart = (period: Period): Date => {
  const now = new Date()
  const d = new Date(now)
  if (period === 'day') d.setDate(d.getDate() - 1)
  else if (period === 'week') d.setDate(d.getDate() - 7)
  else d.setDate(d.getDate() - 30)
  return d
}

// Cache en memoria por (period, nsfw, contentKind); la consulta DISTINCT sobre
// views es pesada y la landing es la página más visitada.
const cache = new Map<string, { data: any[]; expiresAt: number }>()
const CACHE_TTL_MS = 10 * 60 * 1000

export const getTrending = async (
  period: Period = 'day',
  limit = 10,
  nsfw?: boolean,
  contentKind: ContentKind = 'all'
) => {
  const cacheKey = `${period}:${nsfw}:${contentKind}`
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.data

  const since = periodStart(period)

  // Lectores únicos por obra = COUNT(DISTINCT ip). groupBy de Prisma no soporta
  // DISTINCT, así que usamos SQL crudo para los candidatos.
  const rawManga = await prisma.$queryRaw<
    Array<{ mangaCustomId: number; readers: bigint }>
  >(
    Prisma.sql`
      SELECT "mangaCustomId", COUNT(DISTINCT ip) AS readers
      FROM views
      WHERE "viewedAt" >= ${since} AND "mangaCustomId" IS NOT NULL
      GROUP BY "mangaCustomId"
      ORDER BY readers DESC
      LIMIT 30
    `
  )
  const rawJoint =
    nsfw === true || contentKind === 'writing'
      ? []
      : await prisma.$queryRaw<Array<{ jointId: number; readers: bigint }>>(
          Prisma.sql`
          SELECT "jointId", COUNT(DISTINCT ip) AS readers
          FROM views
          WHERE "viewedAt" >= ${since} AND "jointId" IS NOT NULL
          GROUP BY "jointId"
          ORDER BY readers DESC
          LIMIT 30
        `
        )

  const readersByCustom = new Map<number, number>(
    rawManga.map((r) => [r.mangaCustomId, Number(r.readers)])
  )
  const readersByJoint = new Map<number, number>(
    rawJoint.map((r) => [r.jointId, Number(r.readers)])
  )

  const customIds = [...readersByCustom.keys()]
  const jointIds = [...readersByJoint.keys()]
  if (customIds.length === 0 && jointIds.length === 0) {
    cache.set(cacheKey, { data: [], expiresAt: Date.now() + CACHE_TTL_MS })
    return []
  }

  const mangaFilter: any = {
    id: { in: customIds },
    deletedAt: null,
    isPublic: true,
    OR: [{ imageUrl: { not: null } }, { manga: { imageUrl: { not: null } } }],
    AND: [{ organization: { isPublic: true, isDeleted: false } }]
  }
  // Clasificación por MANGA: /red solo +18, azul solo no-+18.
  if (nsfw === true)
    mangaFilter.AND.push({ isNSFW: true })
  else if (nsfw === false)
    mangaFilter.AND.push({ isNSFW: false })
  if (contentKind === 'writing')
    mangaFilter.manga = { bookType: { code: { in: WRITING_BOOK_TYPE_CODES } } }
  else if (contentKind === 'manga')
    mangaFilter.manga = {
      bookType: { code: { notIn: WRITING_BOOK_TYPE_CODES } }
    }

  const [mangasCustoms, joints] = await Promise.all([
    customIds.length === 0
      ? Promise.resolve([] as any[])
      : prisma.mangaCustom.findMany({
          where: mangaFilter,
          include: {
            manga: {
              select: { id: true, title: true, slug: true, imageUrl: true }
            },
            organization: {
              select: { id: true, name: true, slug: true, isNSFW: true }
            },
            chapters: {
              where: { deletedAt: null, releasedAt: { not: null } },
              select: { id: true, number: true, title: true, releasedAt: true },
              orderBy: { number: Prisma.SortOrder.desc },
              take: 2
            }
          }
        }),
    jointIds.length === 0
      ? Promise.resolve([] as any[])
      : prisma.mangaJoint.findMany({
          where: { id: { in: jointIds }, deletedAt: null },
          include: {
            manga: {
              select: { id: true, title: true, slug: true, imageUrl: true }
            },
            chapters: {
              where: { deletedAt: null, releasedAt: { not: null } },
              select: { id: true, number: true, title: true, releasedAt: true },
              orderBy: { number: Prisma.SortOrder.desc },
              take: 2
            }
          }
        })
  ])

  // Dedup por obra base: elige el representante con más lectores (joint gana si
  // existe, igual que popular-today, porque la página del manga redirige ahí).
  type Entry = { mangaId: number; readers: number; joint?: any; mc?: any }
  const byManga = new Map<number, Entry>()
  for (const mc of mangasCustoms) {
    const cover = mc.imageUrl || mc.manga.imageUrl
    if (!cover) continue
    const readers = readersByCustom.get(mc.id) ?? 0
    const existing = byManga.get(mc.manga.id)
    if (!existing || readers > existing.readers) {
      byManga.set(mc.manga.id, {
        mangaId: mc.manga.id,
        readers: Math.max(readers, existing?.readers ?? 0),
        mc,
        joint: existing?.joint
      })
    }
  }
  for (const j of joints) {
    const cover = j.imageUrl || j.manga.imageUrl
    if (!cover) continue
    const readers = readersByJoint.get(j.id) ?? 0
    const existing = byManga.get(j.manga.id)
    byManga.set(j.manga.id, {
      mangaId: j.manga.id,
      readers: Math.max(readers, existing?.readers ?? 0),
      joint: j,
      mc: existing?.mc
    })
  }

  const ranked = [...byManga.values()]
    .filter((e) => e.joint || e.mc)
    .sort((a, b) => b.readers - a.readers)
    .slice(0, limit)

  const data = ranked.map((entry) => {
    if (entry.joint) {
      const j = entry.joint
      return {
        id: `joint-${j.id}`,
        title: j.title || j.manga.title,
        cover: j.imageUrl || j.manga.imageUrl || '',
        scanName: 'Joint',
        scanSlug: '',
        scanUrl: '/scans',
        mangaSlug: j.slug,
        mangaUrl: `/joint/manga/${j.slug}`,
        badgeColor: 'bg-purple-600',
        readers: entry.readers,
        views: j.views || 0,
        chapters: j.chapters.map((c: any) => ({
          id: c.id,
          number: c.number,
          title: c.title,
          releasedAt: c.releasedAt,
          chapterUrl: `/joint/manga/${j.slug}/chapters/${c.number}`
        })),
        organizationId: 0,
        isNSFW: false,
        isJoint: true
      }
    }
    const mc = entry.mc
    return {
      id: mc.id.toString(),
      title: mc.title || mc.manga.title,
      cover: mc.imageUrl || mc.manga.imageUrl || '',
      scanName: mc.organization.name,
      scanSlug: mc.organization.slug,
      scanUrl: `/${mc.organization.slug}`,
      mangaSlug: mc.manga.slug,
      mangaUrl: `/${mc.organization.slug}/manga/${mc.manga.slug}`,
      badgeColor: getBadgeColor(mc.organization.name),
      readers: entry.readers,
      views: mc.views || 0,
      chapters: mc.chapters.map((c: any) => ({
        id: c.id,
        number: c.number,
        title: c.title,
        releasedAt: c.releasedAt,
        chapterUrl: `/${mc.organization.slug}/manga/${mc.manga.slug}/chapters/${c.number}`
      })),
      organizationId: mc.organization.id,
      isNSFW: mc.isNSFW || mc.organization.isNSFW,
      isJoint: false
    }
  })

  cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS })
  return data
}
