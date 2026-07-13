import { Prisma, prisma } from '../../models/prisma'
import {
  type MangaCustomListQuery,
  OrderEnum
} from '../../types/manga-custom/list'

export const listMangaCustom = async (
  organizationId: number | null,
  filters: MangaCustomListQuery
) => {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  const order: any = {}

  // Búsqueda por relevancia: SOLO título (custom + base) y autor. NO descripción
  // (una palabra corta matcheaba la descripción de cualquier obra: basura).
  const searchConditions = filters.search
    ? {
        OR: [
          {
            title: {
              contains: filters.search,
              mode: Prisma.QueryMode.insensitive
            }
          },
          {
            manga: {
              title: {
                contains: filters.search,
                mode: Prisma.QueryMode.insensitive
              }
            }
          },
          {
            manga: {
              authors: {
                some: {
                  name: {
                    contains: filters.search,
                    mode: Prisma.QueryMode.insensitive
                  }
                }
              }
            }
          }
        ]
      }
    : {}

  // Normaliza para ordenar por relevancia sin depender de acentos.
  const normalize = (s: string) =>
    s
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim()
  const searchNorm = filters.search ? normalize(filters.search) : ''

  if (filters.order === OrderEnum.FEATURED) {
    order.orderBy = {
      views: Prisma.SortOrder.desc
    }
  } else if (filters.order === OrderEnum.LATEST) {
    order.orderBy = {
      lastChapterAt: {
        sort: Prisma.SortOrder.desc,
        nulls: Prisma.NullsOrder.last
      }
    }
  } else if (filters.order === OrderEnum.ALPHABETICAL) {
    order.orderBy = { title: Prisma.SortOrder.asc }
  } else if (filters.order === OrderEnum.POPULAR) {
    // Optimized popular query: Get manga IDs with view counts first, then fetch only needed mangas
    const whereCondition = {
      ...(organizationId
        ? {
            mangaCustom: {
              organization: {
                id: organizationId
              },
              deletedAt: null
            }
          }
        : {
            mangaCustom: {
              deletedAt: null
            }
          }),
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
      }
    }

    // Get aggregated view counts per manga
    const viewCounts = await prisma.viewsHistory.groupBy({
      by: ['mangaCustomId'],
      where: whereCondition,
      _count: {
        ip: true
      },
      orderBy: {
        _count: {
          ip: Prisma.SortOrder.desc
        }
      },
      take: 100 // Limit to top 100 to avoid loading all data
    })

    // Apply pagination to the view counts
    const skip = filters?.page
      ? (Number.parseInt(filters?.page || '1') - 1) *
        Number.parseInt(filters?.limit || '10')
      : 0
    const take = Number.parseInt(filters?.limit || '10')
    const paginatedIds = viewCounts
      .slice(skip, skip + take)
      .map((v) => v.mangaCustomId)
      .filter((v) => v !== null)

    // Parse IDs filter if provided
    const idsFilter = filters.ids
      ? {
          id: {
            in: filters.ids
              .split(',')
              .map((id) => Number.parseInt(id.trim(), 10))
              .filter((id) => !Number.isNaN(id))
          }
        }
      : {}

    // Build nsfw filter for popular path
    const popularNsfwFilter =
      filters.nsfw === 'true'
        ? organizationId
          ? {} // En página de org /red/: sin filtro adicional
          : { OR: [{ isNSFW: true }, { organization: { isNSFW: true } }] }
        : filters.nsfw === 'false'
          ? organizationId
            ? { isNSFW: false }
            : { isNSFW: false, organization: { isNSFW: false } }
          : {}

    // Hide deactivated orgs (isPublic=false or isDeleted=true) from global
    // listings. Org-specific paths skip this — middleware already gates.
    const popularOrgVisibility = !organizationId
      ? [{ organization: { isPublic: true, isDeleted: false } }]
      : []

    // Fetch only the paginated mangas with their relations
    const popularMangasCustoms = await prisma.mangaCustom.findMany({
      where: {
        id: {
          in: paginatedIds
        },
        deletedAt: null,
        ...popularNsfwFilter,
        ...(popularOrgVisibility.length > 0
          ? { AND: popularOrgVisibility }
          : {}),
        ...(filters.search ? searchConditions : {}),
        ...(filters.title
          ? {
              title: {
                contains: filters.title,
                mode: Prisma.QueryMode.insensitive
              }
            }
          : {}),
        ...(filters.shortDescription
          ? {
              shortDescription: {
                contains: filters.shortDescription,
                mode: Prisma.QueryMode.insensitive
              }
            }
          : {}),
        ...(filters.description
          ? {
              description: {
                contains: filters.description,
                mode: Prisma.QueryMode.insensitive
              }
            }
          : {}),
        ...(filters.status
          ? {
              status: filters.status
            }
          : {}),
        ...(filters.genre
          ? {
              genres: {
                some: {
                  name: {
                    equals: filters.genre,
                    mode: Prisma.QueryMode.insensitive
                  }
                }
              }
            }
          : {}),
        ...(filters.author
          ? {
              manga: { authors: { some: { slug: filters.author } } }
            }
          : {}),
        ...idsFilter
      },
      include: {
        manga: {
          include: {
            demography: {
              select: {
                name: true,
                slug: true
              }
            }
          }
        },
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            title: true,
            isNSFW: true
          }
        },
        chapters: {
          where: { deletedAt: null },
          select: {
            id: true,
            number: true,
            title: true,
            releasedAt: true,
            isUnreleased: true
          },
          orderBy: {
            number: Prisma.SortOrder.desc
          },
          take: 2
        },
        genres: {
          select: {
            id: true,
            slug: true,
            name: true
          }
        },
        subscriptionPlansCanReadUnreleased: {
          select: {
            id: true,
            name: true
          }
        },
        subscriptionPlansCanReadReleased: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    // Sort by view count order
    const viewCountMap = new Map(
      viewCounts.map((v) => [v.mangaCustomId, v._count.ip])
    )
    const sortedMangas = popularMangasCustoms.sort(
      (a, b) => (viewCountMap.get(b.id) || 0) - (viewCountMap.get(a.id) || 0)
    )

    // Same joint-merge as the main branch — popular cards need the joint
    // chapters too, otherwise a leader org's card shows stale per-org top-2.
    await mergeJointChaptersIntoMangaCustoms(sortedMangas)

    // Inject joints for member orgs that have no MangaCustom for the manga.
    // Solo en la página 1: la inyección no es consciente de la paginación y
    // repetiría los mismos joints en cada página.
    const popularFirstPage =
      !filters?.page || Number.parseInt(filters.page) <= 1
    if (organizationId && popularFirstPage) {
      await injectMemberJointEntries(sortedMangas, organizationId, filters)
    }

    // Hide unreleased chapter previews on cards where the flag is set.
    const nowPopular = new Date()
    for (const mc of sortedMangas) {
      if (mc.hideUnreleasedChapters) {
        mc.chapters = mc.chapters.filter(
          (c: any) =>
            !c.isUnreleased &&
            (!c.releasedAt || new Date(c.releasedAt) <= nowPopular)
        )
      }
    }

    return {
      data: sortedMangas,
      maxPage: Math.ceil(
        viewCounts.length / Number.parseInt(filters?.limit || '10')
      ),
      total: viewCounts.length
    }
  }

  // Parse IDs filter if provided
  const idsFilter = filters.ids
    ? {
        id: {
          in: filters.ids
            .split(',')
            .map((id) => Number.parseInt(id.trim(), 10))
            .filter((id) => !Number.isNaN(id))
        }
      }
    : {}

  // nsfw=false: excluir mangas NSFW
  // nsfw=true + org específica: mostrar todo (la ruta /red/ ya valida adultos, no filtrar más)
  // nsfw=true + sin org (global): mostrar mangas NSFW o de orgs NSFW
  const nsfwFilter =
    filters.nsfw === 'true'
      ? organizationId
        ? {} // En página de org /red/: sin filtro adicional, mostrar todo
        : { OR: [{ isNSFW: true }, { organization: { isNSFW: true } }] }
      : filters.nsfw === 'false'
        ? organizationId
          ? { isNSFW: false }
          : { isNSFW: false, organization: { isNSFW: false } }
        : {}

  // Build soft-delete filter
  const deletedFilter =
    filters.showDeleted === 'true'
      ? { deletedAt: { not: null } }
      : { deletedAt: null }

  // Hide deactivated orgs (isPublic=false or isDeleted=true) from global
  // listings. Org-specific paths skip this — middleware already gates.
  const orgVisibilityAnds = !organizationId
    ? [{ organization: { isPublic: true, isDeleted: false } }]
    : []

  // Build common where clause
  const whereClause = {
    ...deletedFilter,
    ...(filters.type
      ? {
          manga: {
            bookType: {
              code: filters.type
            }
          }
        }
      : filters.contentKind === 'writing'
        ? {
            manga: {
              bookType: {
                code: { in: ['novel', 'light-novel', 'book', 'short-story'] }
              }
            }
          }
        : filters.contentKind === 'manga'
          ? {
              manga: {
                bookType: {
                  code: {
                    notIn: ['novel', 'light-novel', 'book', 'short-story']
                  }
                }
              }
            }
          : {}),
    ...(organizationId
      ? {
          organization: {
            id: organizationId
          }
        }
      : {}),
    ...nsfwFilter,
    ...(orgVisibilityAnds.length > 0 ? { AND: orgVisibilityAnds } : {}),
    ...(filters.search ? searchConditions : {}),
    ...(filters.title
      ? {
          title: {
            contains: filters.title,
            mode: Prisma.QueryMode.insensitive
          }
        }
      : {}),
    ...(filters.shortDescription
      ? {
          shortDescription: {
            contains: filters.shortDescription,
            mode: Prisma.QueryMode.insensitive
          }
        }
      : {}),
    ...(filters.description
      ? {
          description: {
            contains: filters.description,
            mode: Prisma.QueryMode.insensitive
          }
        }
      : {}),
    ...(filters.status
      ? {
          status: filters.status
        }
      : {}),
    ...(filters.genre
      ? {
          genres: {
            some: {
              name: {
                equals: filters.genre,
                mode: Prisma.QueryMode.insensitive
              }
            }
          }
        }
      : {}),
    ...(filters.author
      ? {
          manga: { authors: { some: { slug: filters.author } } }
        }
      : {}),
    ...idsFilter
  }

  // Use Promise.all to run queries in parallel
  const [mangasCustoms, total] = await Promise.all([
    prisma.mangaCustom.findMany({
      where: whereClause,
      include: {
        manga: {
          include: {
            demography: {
              select: {
                name: true,
                slug: true
              }
            }
          }
        },
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            title: true,
            isNSFW: true
          }
        },
        chapters: {
          where: { deletedAt: null },
          select: {
            id: true,
            number: true,
            title: true,
            releasedAt: true,
            isUnreleased: true,
            views: true
          },
          orderBy: {
            number: Prisma.SortOrder.desc
          },
          take: 2
        },
        genres: {
          select: {
            id: true,
            slug: true,
            name: true
          }
        },
        subscriptionPlansCanReadUnreleased: {
          select: {
            id: true,
            name: true
          }
        }
      },
      ...(order || {}),
      skip: filters?.page
        ? (Number.parseInt(filters?.page || '1') - 1) *
          Number.parseInt(filters?.limit || '10')
        : 0,
      take: Number.parseInt(filters?.limit || '10')
    }),
    prisma.mangaCustom.count({
      where: whereClause
    })
  ])

  // ─── Joint chapter merge ───────────────────────────────────────────────
  // When a mangaCustom belongs to an org that's an ACCEPTED member of an
  // active joint for the same base manga, the latest chapters in the joint
  // won't be visible via mangaCustomId (joint chapters live on jointId, with
  // mangaCustomId=null for new uploads). We pull joint chapters for those
  // mangaCustoms and merge them into the card's `chapters` array so cards
  // surface the real latest chapter (including joint releases), not the
  // stale per-org top-2.
  await mergeJointChaptersIntoMangaCustoms(mangasCustoms)

  // Inject synthetic joint entries for orgs that are ACCEPTED members of a
  // joint but have no MangaCustom for that manga (guest/invited orgs). Without
  // this, invited orgs never see the joint on their landing page or catalog.
  // La inyección no es consciente de la paginación: solo se hace en la página 1
  // para no duplicar los mismos joints en cada página del catálogo.
  const isFirstPage = !filters?.page || Number.parseInt(filters.page) <= 1
  // Re-ordena por recencia y recorta al límite para que los entries inyectados
  // (añadidos DESPUÉS del take de la query) no queden fuera cuando el frontend
  // hace slice(limit). Solo aplica en order=latest y SIN búsqueda: con búsqueda
  // manda el orden por relevancia y recortar podría eliminar un joint que
  // coincide con lo buscado.
  const resortLatestAndTrim = () => {
    if (filters.order !== OrderEnum.LATEST || searchNorm) return
    const take = Number.parseInt(filters?.limit || '10')
    ;(mangasCustoms as any[]).sort((a, b) => {
      const aTs = a.lastChapterAt ? new Date(a.lastChapterAt).getTime() : 0
      const bTs = b.lastChapterAt ? new Date(b.lastChapterAt).getTime() : 0
      return bTs - aTs
    })
    mangasCustoms.splice(take)
  }

  if (organizationId) {
    if (isFirstPage) {
      await injectMemberJointEntries(mangasCustoms, organizationId, filters)
      resortLatestAndTrim()
    }
  } else {
    // Global listing (no org context): inject active joints whose manga is NOT
    // represented by any MangaCustom in the current page. This covers the case
    // where the joint leader org has no MangaCustom for the manga, so the joint
    // would be completely invisible on the main landing / global search.
    if (isFirstPage) {
      await injectGlobalJointEntries(mangasCustoms, filters)
      resortLatestAndTrim()
    }
  }

  // Hide unreleased chapter previews on cards where the flag is set.
  const now = new Date()
  for (const mc of mangasCustoms) {
    if (mc.hideUnreleasedChapters) {
      mc.chapters = mc.chapters.filter(
        (c: any) =>
          !c.isUnreleased && (!c.releasedAt || new Date(c.releasedAt) <= now)
      )
    }
  }

  // En el line-up de "últimas actualizaciones", una obra con la opción de
  // ocultar programados NO debe aparecer si tras el filtro se quedó sin capítulos
  // (su único capítulo reciente está programado): entraría con card vacía. Solo
  // aparece cuando ya tiene un capítulo publicado.
  if (filters.order === OrderEnum.LATEST) {
    for (let i = mangasCustoms.length - 1; i >= 0; i--) {
      const mc: any = mangasCustoms[i]
      if (
        mc.hideUnreleasedChapters &&
        (!mc.chapters || mc.chapters.length === 0)
      ) {
        mangasCustoms.splice(i, 1)
      }
    }
  }

  // Relevancia en búsqueda: empieza-con > contiene como palabra > contiene >
  // match por autor. Ordena la página en memoria (acentos ignorados).
  if (searchNorm) {
    const rank = (mc: any): number => {
      const title = normalize(mc.title || mc.manga?.title || '')
      if (title.startsWith(searchNorm)) return 0
      if (
        new RegExp(
          `(^|\\s)${searchNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
        ).test(title)
      )
        return 1
      if (title.includes(searchNorm)) return 2
      return 3 // match por autor u otro
    }
    ;(mangasCustoms as any[]).sort((a, b) => rank(a) - rank(b))
  }

  return {
    data: mangasCustoms,
    maxPage: Math.ceil(total / Number.parseInt(filters?.limit || '10')),
    total:
      total + (mangasCustoms.length > total ? mangasCustoms.length - total : 0)
  }
}

// Merges joint chapter previews into each mangaCustom's `chapters` array
// in-place. For mangaCustoms whose org is an ACCEPTED member of an active
// joint for the same base manga, augments the top-N chapter list with joint
// chapters and re-dedupes by chapter number, keeping the most recently
// released entry. Used by both the popular and main listing branches.
async function mergeJointChaptersIntoMangaCustoms(
  mangaCustoms: any[]
): Promise<void> {
  if (mangaCustoms.length === 0) return
  const mangaIds = Array.from(new Set(mangaCustoms.map((m) => m.mangaId)))
  const orgMcByKey = new Map<string, any>()
  for (const mc of mangaCustoms)
    orgMcByKey.set(`${mc.organizationId}-${mc.mangaId}`, mc)

  const joints = await prisma.mangaJoint.findMany({
    where: { mangaId: { in: mangaIds }, deletedAt: null },
    select: {
      id: true,
      slug: true,
      mangaId: true,
      members: {
        where: { status: 'ACCEPTED' },
        select: { organizationId: true }
      },
      chapters: {
        where: { deletedAt: null },
        orderBy: { number: Prisma.SortOrder.desc },
        take: 5,
        select: {
          id: true,
          number: true,
          title: true,
          releasedAt: true,
          views: true
        }
      }
    }
  })

  for (const joint of joints) {
    for (const member of joint.members) {
      const mc = orgMcByKey.get(`${member.organizationId}-${joint.mangaId}`)
      if (!mc) continue
      const existing: any[] = Array.isArray(mc.chapters) ? mc.chapters : []
      // Tag joint chapters so the frontend can build the correct /joint/manga/<slug>/chapters/<n> URL.
      const taggedJointChapters = joint.chapters.map((c: any) => ({
        ...c,
        _jointSlug: joint.slug
      }))
      const merged = new Map<number, any>()
      for (const c of [...existing, ...taggedJointChapters]) {
        const prev = merged.get(c.number)
        if (!prev) {
          merged.set(c.number, c)
          continue
        }
        const prevTs = prev.releasedAt ? new Date(prev.releasedAt).getTime() : 0
        const cTs = c.releasedAt ? new Date(c.releasedAt).getTime() : 0
        if (cTs > prevTs) merged.set(c.number, c)
      }
      mc.chapters = [...merged.values()]
        .sort((a, b) => b.number - a.number)
        .slice(0, 2)
    }
  }
}

// Appends synthetic MangaCustom-shaped entries for every active joint where
// `organizationId` is an ACCEPTED member but the manga is not already present
// in `mangasCustoms` (i.e., the org has no own MangaCustom for that manga).
// This ensures invited/guest orgs see the joint on their landing page and catalog.
async function injectMemberJointEntries(
  mangasCustoms: any[],
  organizationId: number,
  filters: any
): Promise<void> {
  const coveredMangaIds = new Set(
    mangasCustoms.map((mc) => mc.manga?.id).filter(Boolean)
  )

  const joints = await prisma.mangaJoint.findMany({
    where: {
      deletedAt: null,
      members: { some: { organizationId, status: 'ACCEPTED' } },
      ...(coveredMangaIds.size > 0
        ? { mangaId: { notIn: [...coveredMangaIds] } }
        : {})
    },
    select: {
      id: true,
      slug: true,
      title: true,
      imageUrl: true,
      mangaId: true,
      lastChapterAt: true,
      manga: {
        include: {
          demography: { select: { name: true, slug: true } },
          bookType: { select: { code: true, name: true } }
        }
      },
      members: {
        where: { organizationId, status: 'ACCEPTED' },
        select: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              title: true,
              isNSFW: true,
              isPublic: true
            }
          }
        },
        take: 1
      },
      chapters: {
        where: { deletedAt: null },
        orderBy: { number: Prisma.SortOrder.desc },
        take: 2,
        select: {
          id: true,
          number: true,
          title: true,
          releasedAt: true,
          isUnreleased: true,
          views: true
        }
      }
    }
  })

  // Fetch display titles/covers from existing MangaCustom records for the
  // same manga (any org). The MangaCustom title (e.g. "Adicto a Lilim") is
  // the localized/scan name and takes priority over the joint or manga title.
  const jointMangaIds = joints.map((j) => j.mangaId)
  const existingCustoms = jointMangaIds.length
    ? await prisma.mangaCustom.findMany({
        where: { mangaId: { in: jointMangaIds }, deletedAt: null },
        select: { mangaId: true, title: true, imageUrl: true }
      })
    : []
  const customMetaByMangaId = new Map<
    number,
    { title: string; imageUrl: string | null }
  >()
  for (const mc of existingCustoms) {
    if (!customMetaByMangaId.has(mc.mangaId) && mc.title) {
      customMetaByMangaId.set(mc.mangaId, {
        title: mc.title,
        imageUrl: mc.imageUrl
      })
    }
  }

  for (const joint of joints) {
    const customMeta = customMetaByMangaId.get(joint.mangaId)
    const displayTitle =
      customMeta?.title || joint.title || joint.manga?.title || ''
    const displayImage =
      customMeta?.imageUrl || joint.imageUrl || joint.manga?.imageUrl || ''

    // Basic title/search filter so catalog search still works for joints
    const searchTerm = filters?.search || filters?.title
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      if (!displayTitle.toLowerCase().includes(q)) continue
    }

    const org = joint.members[0]?.organization
    if (!org) continue

    const taggedChapters = joint.chapters.map((c: any) => ({
      ...c,
      _jointSlug: joint.slug
    }))

    mangasCustoms.push({
      id: `joint-${joint.id}`,
      title: displayTitle,
      imageUrl: displayImage,
      slug: joint.slug,
      status: 'Ongoing',
      isNSFW: false,
      hideUnreleasedChapters: false,
      deletedAt: null,
      lastChapterAt: joint.lastChapterAt,
      organization: org,
      manga: joint.manga,
      chapters: taggedChapters,
      genres: [],
      subscriptionPlansCanReadUnreleased: [],
      subscriptionPlansCanReadReleased: [],
      _jointSlug: joint.slug
    })
  }
}

// Injects synthetic MangaCustom-shaped entries for active joints whose manga
// is NOT already covered by any MangaCustom in `mangasCustoms`. Used for the
// global listing (no org context) so joints appear on the main landing page
// even when none of their member orgs has a standalone MangaCustom for the manga.
async function injectGlobalJointEntries(
  mangasCustoms: any[],
  filters: any
): Promise<void> {
  const coveredMangaIds = new Set(
    mangasCustoms.map((mc) => mc.mangaId).filter(Boolean)
  )

  const joints = await prisma.mangaJoint.findMany({
    where: {
      deletedAt: null,
      ...(coveredMangaIds.size > 0
        ? { mangaId: { notIn: [...coveredMangaIds] } }
        : {})
    },
    select: {
      id: true,
      slug: true,
      title: true,
      imageUrl: true,
      mangaId: true,
      lastChapterAt: true,
      manga: {
        include: {
          demography: { select: { name: true, slug: true } },
          bookType: { select: { code: true, name: true } }
        }
      },
      members: {
        where: { status: 'ACCEPTED' },
        select: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              title: true,
              isNSFW: true,
              isPublic: true
            }
          }
        },
        take: 1
      },
      chapters: {
        where: { deletedAt: null },
        orderBy: { number: Prisma.SortOrder.desc },
        take: 2,
        select: {
          id: true,
          number: true,
          title: true,
          releasedAt: true,
          isUnreleased: true,
          views: true
        }
      }
    }
  })

  const jointMangaIds = joints.map((j) => j.mangaId)
  const existingCustoms = jointMangaIds.length
    ? await prisma.mangaCustom.findMany({
        where: { mangaId: { in: jointMangaIds }, deletedAt: null },
        select: { mangaId: true, title: true, imageUrl: true }
      })
    : []
  const customMetaByMangaId = new Map<
    number,
    { title: string; imageUrl: string | null }
  >()
  for (const mc of existingCustoms) {
    if (!customMetaByMangaId.has(mc.mangaId) && mc.title) {
      customMetaByMangaId.set(mc.mangaId, {
        title: mc.title,
        imageUrl: mc.imageUrl
      })
    }
  }

  for (const joint of joints) {
    const org = joint.members[0]?.organization
    if (!org || org.isPublic === false) continue

    const customMeta = customMetaByMangaId.get(joint.mangaId)
    const displayTitle =
      customMeta?.title || joint.title || joint.manga?.title || ''
    const displayImage = customMeta?.imageUrl || joint.imageUrl || null

    const searchTerm = filters?.search || filters?.title
    if (
      searchTerm &&
      !displayTitle.toLowerCase().includes(searchTerm.toLowerCase())
    )
      continue

    const taggedChapters = joint.chapters.map((c: any) => ({
      ...c,
      _jointSlug: joint.slug
    }))

    mangasCustoms.push({
      id: `joint-${joint.id}`,
      title: displayTitle,
      imageUrl: displayImage,
      slug: joint.slug,
      mangaId: joint.mangaId,
      lastChapterAt: joint.lastChapterAt,
      status: 'Ongoing',
      isNSFW: false,
      hideUnreleasedChapters: false,
      deletedAt: null,
      organization: org,
      manga: joint.manga,
      chapters: taggedChapters,
      genres: [],
      subscriptionPlansCanReadUnreleased: [],
      subscriptionPlansCanReadReleased: [],
      _jointSlug: joint.slug
    })
  }
}
