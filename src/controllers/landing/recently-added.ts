import { Prisma, prisma } from '../../models/prisma'

const WRITING_BOOK_TYPE_CODES = ['novel', 'light-novel', 'book', 'short-story']

type ContentKind = 'manga' | 'writing' | 'all'

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

// Obras más recientemente AGREGADAS a la plataforma (por createdAt), distinto
// de "últimas actualizaciones" que son capítulos nuevos.
export const getRecentlyAdded = async (
  limit = 10,
  nsfw?: boolean,
  contentKind: ContentKind = 'all'
) => {
  const where: any = {
    deletedAt: null,
    isPublic: true,
    OR: [{ imageUrl: { not: null } }, { manga: { imageUrl: { not: null } } }],
    AND: [{ organization: { isPublic: true, isDeleted: false } }]
  }
  // Clasificación por MANGA: /red solo +18, azul solo no-+18.
  if (nsfw === true)
    where.AND.push({ isNSFW: true })
  else if (nsfw === false)
    where.AND.push({ isNSFW: false })
  if (contentKind === 'writing')
    where.manga = { bookType: { code: { in: WRITING_BOOK_TYPE_CODES } } }
  else if (contentKind === 'manga')
    where.manga = { bookType: { code: { notIn: WRITING_BOOK_TYPE_CODES } } }

  const mangas = await prisma.mangaCustom.findMany({
    where,
    orderBy: { createdAt: Prisma.SortOrder.desc },
    take: limit,
    include: {
      manga: { select: { title: true, slug: true, imageUrl: true } },
      organization: {
        select: { id: true, name: true, slug: true, isNSFW: true }
      },
      // Primer capítulo publicado (menor número), para el acceso directo a leer.
      chapters: {
        where: { deletedAt: null, releasedAt: { not: null } },
        select: { number: true },
        orderBy: { number: Prisma.SortOrder.asc },
        take: 1
      }
    }
  })

  return mangas
    .filter((mc) => mc.imageUrl || mc.manga.imageUrl)
    .map((mc) => {
      const firstNumber = mc.chapters[0]?.number
      return {
        id: mc.id.toString(),
        title: mc.title || mc.manga.title,
        cover: mc.imageUrl || mc.manga.imageUrl || '',
        scanName: mc.organization.name,
        scanSlug: mc.organization.slug,
        scanUrl: `/${mc.organization.slug}`,
        mangaSlug: mc.manga.slug,
        mangaUrl: `/${mc.organization.slug}/manga/${mc.manga.slug}`,
        firstChapterNumber: firstNumber ?? null,
        firstChapterUrl:
          firstNumber != null
            ? `/${mc.organization.slug}/manga/${mc.manga.slug}/chapters/${firstNumber}`
            : null,
        badgeColor: getBadgeColor(mc.organization.name),
        createdAt: mc.createdAt,
        organizationId: mc.organization.id,
        isNSFW: mc.isNSFW || mc.organization.isNSFW
      }
    })
}
