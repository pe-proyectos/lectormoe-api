import { Prisma, prisma } from '../../models/prisma'
import {
  type MangaCustomListQuery,
  OrderEnum
} from '../../types/manga-custom/list'

export const listMangaCustom = async (
  organizationId: number | null,
  filters: MangaCustomListQuery,
  user?: any
) => {
  // Obras privadas (isPublic=false) se ocultan de TODO listado público. Solo el
  // STAFF del scan en contexto las ve (para su panel). En el catálogo global (sin
  // org) nunca se muestran.
  const isStaffOfOrg = !!(
    organizationId &&
    user?.permissions?.some(
      (p: any) => p.organizationId === organizationId && p.canSeeAdminPanel
    )
  )
  const publicFilter = isStaffOfOrg ? {} : { isPublic: true }
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  const order: any = {}

  // Búsqueda por relevancia: título (custom + base), título alternativo y
  // autor. NO descripción (una palabra corta matcheaba la descripción de
  // cualquier obra: basura).
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
            // El nombre original o en romaji que pone el scan: mucha gente
            // busca por ahí en vez de por el título traducido.
            alternativeTitle: {
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
    // Popularidad = vistas totales (campo denormalizado `views`, indexado).
    // Antes se calculaba con vistas de las ultimas 24h y se limitaba al top-100
    // ANTES de aplicar los filtros, asi que al filtrar/buscar algo sin vistas
    // recientes la lista salia VACIA (bug intermitente). Ordenar el conjunto YA
    // filtrado por `views` da la misma popularidad, nunca vacio y usa el indice.
    order.orderBy = { views: Prisma.SortOrder.desc }
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

  // Clasificación 100% por MANGA (ya no hay NSFW por-scan): /red (nsfw=true)
  // muestra SOLO mangas +18; el azul (nsfw=false) muestra SOLO los que no son
  // +18. Sirve igual dentro de un scan o en el listado global.
  const nsfwFilter =
    filters.nsfw === 'true'
      ? { isNSFW: true }
      : filters.nsfw === 'false'
        ? { isNSFW: false }
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
    ...publicFilter,
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
          // "completed" y "finished" son sinónimos (dos valores para "finalizado").
          status:
            filters.status === 'completed' || filters.status === 'finished'
              ? { in: ['completed', 'finished'] }
              : filters.status
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
    ...((filters as any).isOneShot === 'true' || (filters as any).isOneShot === true
      ? { isOneShot: true }
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

  // La inyección de joints NO respeta filtros estructurados (autor/género/estado):
  // solo filtra por texto. Con un filtro activo (p. ej. ?author=), inyectar joints
  // sin filtrar metía obras "que nada que ver". Solo inyectamos en el catálogo/
  // landing sin filtro específico (o con búsqueda de texto, que sí se aplica).
  const hasNarrowingFilter = !!(
    filters.author ||
    filters.genre ||
    filters.status ||
    (filters as any).isOneShot === 'true' ||
    filters.ids
  )

  if (organizationId) {
    if (isFirstPage && !hasNarrowingFilter) {
      await injectMemberJointEntries(mangasCustoms, organizationId, filters)
      resortLatestAndTrim()
    }
  } else {
    // Global listing (no org context): inject active joints whose manga is NOT
    // represented by any MangaCustom in the current page. This covers the case
    // where the joint leader org has no MangaCustom for the manga, so the joint
    // would be completely invisible on the main landing / global search.
    if (isFirstPage && !hasNarrowingFilter) {
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
      const escaped = searchNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const candidatos = [
        normalize(mc.title || mc.manga?.title || ''),
        normalize(mc.alternativeTitle || ''),
      ].filter(Boolean)

      let mejor = 3 // match por autor u otro
      for (const title of candidatos) {
        if (title.startsWith(searchNorm)) return 0
        if (new RegExp(`(^|\\s)${escaped}`).test(title)) mejor = Math.min(mejor, 1)
        else if (title.includes(searchNorm)) mejor = Math.min(mejor, 2)
      }
      return mejor
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
      views: true,
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
      // Vistas efectivas: la obra en joint ya no acumula en MangaCustom.views
      // (se "congela"); sus lecturas viven en MangaJoint.views. Sumamos el total
      // del joint para que la tarjeta del scan muestre las vistas reales.
      mc.views = (mc.views || 0) + (joint.views || 0)
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
/**
 * Con que titulo y portada se muestra un joint.
 *
 * Solo cuentan las fichas de los scans que PARTICIPAN en el joint. Antes se
 * cogia la primera MangaCustom de ese manga de CUALQUIER scan, y ganaba la de
 * id mas bajo: por eso a katsudonmanga le salia su colaboracion con el nombre y
 * la portada de haruscan, un scan que publica la misma obra por su cuenta pero
 * no forma parte del joint.
 *
 * Orden de preferencia:
 *   1. la ficha del scan que esta mirando, si la tiene (es su catalogo),
 *   2. la identidad propia del joint, que es la que acordaron sus miembros,
 *   3. la ficha de otro miembro,
 *   4. el manga base.
 */
async function identidadDeJoints(
  joints: Array<{ id: number; mangaId: number; title: string | null; imageUrl: string | null }>,
  organizationId?: number
): Promise<Map<number, { title: string; alternativeTitle: string | null; imageUrl: string | null }>> {
  const identidad = new Map<number, { title: string; alternativeTitle: string | null; imageUrl: string | null }>()
  if (joints.length === 0) return identidad

  const miembros = await prisma.jointMember.findMany({
    where: { jointId: { in: joints.map((j) => j.id) }, status: 'ACCEPTED' },
    select: { jointId: true, organizationId: true }
  })
  const orgsPorJoint = new Map<number, Set<number>>()
  for (const m of miembros) {
    if (!orgsPorJoint.has(m.jointId)) orgsPorJoint.set(m.jointId, new Set())
    orgsPorJoint.get(m.jointId)!.add(m.organizationId)
  }

  const customs = await prisma.mangaCustom.findMany({
    where: { mangaId: { in: joints.map((j) => j.mangaId) }, deletedAt: null },
    select: { mangaId: true, organizationId: true, title: true, alternativeTitle: true, imageUrl: true },
    orderBy: { id: 'asc' }
  })

  for (const joint of joints) {
    const orgs = orgsPorJoint.get(joint.id) ?? new Set<number>()
    const deMiembros = customs.filter(
      (c) => c.mangaId === joint.mangaId && orgs.has(c.organizationId) && c.title
    )
    const propia = organizationId
      ? deMiembros.find((c) => c.organizationId === organizationId)
      : undefined

    if (propia) {
      identidad.set(joint.id, {
        title: propia.title,
        alternativeTitle: propia.alternativeTitle || null,
        imageUrl: propia.imageUrl
      })
      continue
    }

    const otroMiembro = deMiembros[0]
    identidad.set(joint.id, {
      title: joint.title || otroMiembro?.title || '',
      alternativeTitle: otroMiembro?.alternativeTitle || null,
      imageUrl: joint.imageUrl || otroMiembro?.imageUrl || null
    })
  }
  return identidad
}

// El mismo criterio que nsfwFilter pero para joints: /red solo +18, azul solo
// no-+18, y sin filtro cuando no se pide (admin, herramientas internas).
function jointNsfwFilter(filters: any) {
  if (filters?.nsfw === 'true') return { isNSFW: true }
  if (filters?.nsfw === 'false') return { isNSFW: false }
  return {}
}

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
      // Los joints tienen clasificacion propia (ver util/joint-nsfw). Antes esta
      // inyeccion no la aplicaba y metia obras normales en /red.
      ...jointNsfwFilter(filters),
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
      isNSFW: true,
      lastChapterAt: true,
      views: true,
      manga: {
        include: {
          demography: { select: { name: true, slug: true } },
          bookType: { select: { code: true, name: true } }
        }
      },
      members: {
        where: { status: 'ACCEPTED' },
        select: {
          role: true,
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              title: true,
              logoUrl: true,
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

  const identidad = await identidadDeJoints(joints, organizationId)

  for (const joint of joints) {
    const customMeta = identidad.get(joint.id)
    const displayTitle =
      customMeta?.title || joint.title || joint.manga?.title || ''
    const displayImage =
      customMeta?.imageUrl || joint.imageUrl || joint.manga?.imageUrl || ''

    // Basic title/search filter so catalog search still works for joints
    const searchTerm = filters?.search || filters?.title
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      const alt = (customMeta as any)?.alternativeTitle || ''
      const base = joint.manga?.title || ''
      const coincide = [displayTitle, alt, base].some((t) => t && t.toLowerCase().includes(q))
      if (!coincide) continue
    }

    // La tarjeta se acredita al LIDER; el resto de participantes van en
    // `_jointMembers` para el "+N" y el desplegable al pasar el raton.
    const miembros = (joint.members as any[])
      .map((m) => ({ role: m.role, organization: m.organization }))
      .filter((m) => m.organization && m.organization.isPublic !== false)
    const lider = miembros.find((m) => m.role === 'LEADER') ?? miembros[0]
    const org = lider?.organization
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
      isNSFW: !!joint.isNSFW,
      hideUnreleasedChapters: false,
      deletedAt: null,
      lastChapterAt: joint.lastChapterAt,
      views: joint.views || 0,
      organization: org,
      manga: joint.manga,
      chapters: taggedChapters,
      genres: [],
      subscriptionPlansCanReadUnreleased: [],
      subscriptionPlansCanReadReleased: [],
      _jointSlug: joint.slug,
      _jointMembers: miembros.map((m) => ({
        slug: m.organization.slug,
        name: m.organization.name,
        title: m.organization.title,
        logoUrl: m.organization.logoUrl ?? null,
        isLeader: m.role === 'LEADER'
      }))
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
  // Antes solo se traian los joints que la pagina no representaba. Ahora se
  // traen todos: de los que SI aparecen hay que sustituir la ficha suelta del
  // miembro por la tarjeta del joint, para que la colaboracion no se muestre
  // como si fuera de un solo scan (ni duplicada cuando varios miembros tienen
  // ficha propia de la misma obra).
  const joints = await prisma.mangaJoint.findMany({
    where: {
      deletedAt: null,
      ...jointNsfwFilter(filters)
    },
    select: {
      id: true,
      slug: true,
      title: true,
      imageUrl: true,
      mangaId: true,
      isNSFW: true,
      lastChapterAt: true,
      views: true,
      manga: {
        include: {
          demography: { select: { name: true, slug: true } },
          bookType: { select: { code: true, name: true } }
        }
      },
      members: {
        where: { status: 'ACCEPTED' },
        select: {
          role: true,
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              title: true,
              logoUrl: true,
              isNSFW: true,
              isPublic: true
            }
          }
        }
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

  // Quita las fichas sueltas de los scans que participan en el joint: su obra
  // pasa a representarse con la tarjeta de la colaboracion.
  const miembrosPorManga = new Map<number, Set<number>>()
  for (const j of joints) {
    if (!miembrosPorManga.has(j.mangaId)) miembrosPorManga.set(j.mangaId, new Set())
    const set = miembrosPorManga.get(j.mangaId)!
    for (const m of j.members as any[]) set.add(m.organization.id)
  }
  for (let i = mangasCustoms.length - 1; i >= 0; i--) {
    const mc = mangasCustoms[i]
    if (typeof mc.id === 'string') continue // ya es una tarjeta de joint
    const orgs = miembrosPorManga.get(mc.mangaId)
    if (orgs && orgs.has(mc.organization?.id)) mangasCustoms.splice(i, 1)
  }

  const identidad = await identidadDeJoints(joints)

  for (const joint of joints) {
    // La tarjeta se acredita al LIDER; el resto de participantes van en
    // `_jointMembers` para el "+N" y el desplegable al pasar el raton.
    const miembros = (joint.members as any[])
      .map((m) => ({ role: m.role, organization: m.organization }))
      .filter((m) => m.organization && m.organization.isPublic !== false)
    const lider = miembros.find((m) => m.role === 'LEADER') ?? miembros[0]
    const org = lider?.organization
    if (!org || org.isPublic === false) continue

    const customMeta = identidad.get(joint.id)
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
      views: joint.views || 0,
      status: 'Ongoing',
      isNSFW: !!joint.isNSFW,
      hideUnreleasedChapters: false,
      deletedAt: null,
      organization: org,
      manga: joint.manga,
      chapters: taggedChapters,
      genres: [],
      subscriptionPlansCanReadUnreleased: [],
      subscriptionPlansCanReadReleased: [],
      _jointSlug: joint.slug,
      _jointMembers: miembros.map((m) => ({
        slug: m.organization.slug,
        name: m.organization.name,
        title: m.organization.title,
        logoUrl: m.organization.logoUrl ?? null,
        isLeader: m.role === 'LEADER'
      }))
    })
  }
}
