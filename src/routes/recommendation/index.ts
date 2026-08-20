import { Elysia, t } from 'elysia'
import { prisma } from '../../models/prisma'
import { loggedOptional, loggedUserOnly } from '../../plugins/auth'

const MAX_PER_ORG = 6

function assertStaff(user: any, organizationId: number) {
  const perm = user.permissions?.find((p: any) => p.organizationId === organizationId)
  if (!perm?.canSeeAdminPanel) throw new Error('No autorizado.')
}

// Select compartido para pintar la tarjeta de recomendación en la web.
const workInclude = {
  mangaCustom: {
    select: {
      id: true,
      title: true,
      imageUrl: true,
      isNSFW: true,
      manga: { select: { slug: true } },
      organization: { select: { slug: true, name: true, isNSFW: true } },
    },
  },
  joint: { select: { id: true, title: true, imageUrl: true, slug: true, deletedAt: true } },
} as const

// Ventana de fechas + activo. startsAt/endsAt nulos = sin límite por ese lado.
function activeWindowWhere(now: Date) {
  return {
    isActive: true,
    AND: [
      { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
      { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
    ],
  }
}

// La query ya exige que la obra referida esté viva (deletedAt null), así que
// aquí basta con confirmar que el include trajo alguna obra.
function hasLiveWork(r: any): boolean {
  return !!(r.mangaCustom || r.joint)
}

export const router = () =>
  new Elysia()
    .use(loggedOptional())
    // Público por scan: recomendaciones activas de un scan (para su landing).
    .get(
      '/api/recommendation',
      async ({ query }) => {
        if (!query?.org) return { status: true, data: [] }
        const now = new Date()
        const recs = await prisma.organizationRecommendation.findMany({
          where: {
            ...activeWindowWhere(now),
            organization: { slug: query.org },
            OR: [{ mangaCustom: { deletedAt: null } }, { joint: { deletedAt: null } }],
          },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
          take: 12,
          include: workInclude,
        })
        return { status: true, data: recs.filter(hasLiveWork) }
      },
      {
        query: t.Optional(t.Object({ org: t.Optional(t.String()) })),
        response: t.Object({ status: t.Boolean(), data: t.Any() }),
      },
    )
    // Público global: recomendaciones marcadas para el home global (cross-promo).
    .get(
      '/api/recommendation/global',
      async ({ query }) => {
        const now = new Date()
        const nsfw = query?.nsfw === 'true'
        // Traemos TODAS las recos globales elegibles (no solo el top por
        // position/updatedAt): con muchos scans marcando cross-promo, ordenar por
        // position enterraba a los scans "viejos" y su reco no salía nunca. En su
        // lugar rotamos de forma justa (ver abajo).
        const recs = await prisma.organizationRecommendation.findMany({
          where: {
            ...activeWindowWhere(now),
            showOnGlobal: true,
            OR: [{ mangaCustom: { deletedAt: null } }, { joint: { deletedAt: null } }],
          },
          orderBy: [{ updatedAt: 'desc' }],
          take: 300,
          include: {
            ...workInclude,
            organization: { select: { slug: true, name: true, logoUrl: true, isNSFW: true } },
          },
        })
        // Filtra por contexto +18: en el home normal no mostramos obras NSFW.
        // Para joints (sin flag propio) se usa el scan que recomienda.
        const isNsfwRec = (r: any) =>
          !!(r.mangaCustom?.isNSFW || r.mangaCustom?.organization?.isNSFW || r.organization?.isNSFW)
        const pool = recs.filter(hasLiveWork).filter((r) => (nsfw ? true : !isNsfwRec(r)))

        // Rotación JUSTA: barajado determinístico por franja de 10 min (estable
        // para todos los usuarios y cacheable) para que cada scan tenga su turno
        // en el home, más un tope de 2 por scan para que ninguno lo acapare.
        const bucket = Math.floor(now.getTime() / (10 * 60 * 1000))
        const rotationKey = (id: number) => {
          let h = Math.imul((id ^ bucket) >>> 0, 2654435761) >>> 0
          h ^= h >>> 15
          return h >>> 0
        }
        pool.sort((a, b) => rotationKey(a.id) - rotationKey(b.id))
        // 1 por scan para que TODOS los scans con reco global tengan su hueco en
        // el home (si un scan marcó varias, rota cuál se muestra por franja). Tope
        // alto para no cortar mientras haya pocos scans; rota si crecen mucho.
        const MAX_GLOBAL = 20
        const MAX_PER_SCAN_GLOBAL = 1
        const perScan = new Map<number, number>()
        const out: any[] = []
        for (const r of pool) {
          if (out.length >= MAX_GLOBAL) break
          const c = perScan.get(r.organizationId) || 0
          if (c >= MAX_PER_SCAN_GLOBAL) continue
          perScan.set(r.organizationId, c + 1)
          out.push(r)
        }
        return { status: true, data: out }
      },
      {
        query: t.Optional(t.Object({ nsfw: t.Optional(t.String()) })),
        response: t.Object({ status: t.Boolean(), data: t.Any() }),
      },
    )

export const adminRouter = () =>
  new Elysia()
    .use(loggedUserOnly())
    // Lista admin (todas, activas o no, ordenadas).
    .get(
      '/api/organization/recommendation',
      async ({ user, organizationId }) => {
        assertStaff(user, organizationId)
        const recs = await prisma.organizationRecommendation.findMany({
          where: { organizationId },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
          include: workInclude,
        })
        return { status: true, data: recs }
      },
      { response: t.Object({ status: t.Boolean(), data: t.Any() }) },
    )
    // Crear.
    .post(
      '/api/organization/recommendation',
      async ({ user, organizationId, body }) => {
        assertStaff(user, organizationId)
        const hasManga = typeof body.mangaCustomId === 'number'
        const hasJoint = typeof body.jointId === 'number'
        if (hasManga === hasJoint) throw new Error('Indica exactamente una obra (manga o joint).')

        if (hasManga) {
          const mc = await prisma.mangaCustom.findFirst({
            where: { id: body.mangaCustomId!, organizationId, deletedAt: null },
            select: { id: true },
          })
          if (!mc) throw new Error('Ese manga no pertenece a tu scan.')
        } else {
          const member = await prisma.jointMember.findFirst({
            where: { jointId: body.jointId!, organizationId },
            select: { id: true },
          })
          if (!member) throw new Error('Tu scan no participa en ese joint.')
        }

        const count = await prisma.organizationRecommendation.count({ where: { organizationId } })
        if (count >= MAX_PER_ORG) throw new Error(`Alcanzaste el máximo de ${MAX_PER_ORG} recomendaciones. Elimina alguna antes de agregar otra.`)

        const maxPos = await prisma.organizationRecommendation.aggregate({
          where: { organizationId },
          _max: { position: true },
        })
        const rec = await prisma.organizationRecommendation.create({
          data: {
            organizationId,
            mangaCustomId: hasManga ? body.mangaCustomId! : null,
            jointId: hasJoint ? body.jointId! : null,
            label: (body.label?.trim() || 'La recomendación de la casa').slice(0, 80),
            note: body.note?.trim()?.slice(0, 500) || null,
            isActive: body.isActive ?? true,
            showOnGlobal: body.showOnGlobal ?? false,
            startsAt: body.startsAt ? new Date(body.startsAt) : null,
            endsAt: body.endsAt ? new Date(body.endsAt) : null,
            position: (maxPos._max.position ?? -1) + 1,
          },
          include: workInclude,
        })
        return { status: true, data: rec }
      },
      {
        body: t.Object({
          mangaCustomId: t.Optional(t.Number()),
          jointId: t.Optional(t.Number()),
          label: t.Optional(t.String({ maxLength: 80 })),
          note: t.Optional(t.String({ maxLength: 500 })),
          isActive: t.Optional(t.Boolean()),
          showOnGlobal: t.Optional(t.Boolean()),
          startsAt: t.Optional(t.String()),
          endsAt: t.Optional(t.String()),
        }),
        response: t.Object({ status: t.Boolean(), data: t.Any() }),
      },
    )
    // Editar.
    .patch(
      '/api/organization/recommendation/:id',
      async ({ user, organizationId, params, body }) => {
        assertStaff(user, organizationId)
        const rec = await prisma.organizationRecommendation.findUnique({ where: { id: Number.parseInt(params.id) } })
        if (!rec || rec.organizationId !== organizationId) throw new Error('Recomendación no encontrada.')
        const data: any = {}
        if (body.label !== undefined) data.label = (body.label.trim() || 'La recomendación de la casa').slice(0, 80)
        if (body.note !== undefined) data.note = body.note?.trim()?.slice(0, 500) || null
        if (body.isActive !== undefined) data.isActive = !!body.isActive
        if (body.showOnGlobal !== undefined) data.showOnGlobal = !!body.showOnGlobal
        if (body.startsAt !== undefined) data.startsAt = body.startsAt ? new Date(body.startsAt) : null
        if (body.endsAt !== undefined) data.endsAt = body.endsAt ? new Date(body.endsAt) : null
        const updated = await prisma.organizationRecommendation.update({ where: { id: rec.id }, data, include: workInclude })
        return { status: true, data: updated }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          label: t.Optional(t.String({ maxLength: 80 })),
          note: t.Optional(t.String({ maxLength: 500 })),
          isActive: t.Optional(t.Boolean()),
          showOnGlobal: t.Optional(t.Boolean()),
          startsAt: t.Optional(t.String()),
          endsAt: t.Optional(t.String()),
        }),
        response: t.Object({ status: t.Boolean(), data: t.Any() }),
      },
    )
    // Reordenar: recibe los ids en el orden deseado y fija position por índice.
    .patch(
      '/api/organization/recommendation/reorder',
      async ({ user, organizationId, body }) => {
        assertStaff(user, organizationId)
        const own = await prisma.organizationRecommendation.findMany({ where: { organizationId }, select: { id: true } })
        const ownIds = new Set(own.map((r) => r.id))
        const ids = body.ids.filter((id) => ownIds.has(id))
        await prisma.$transaction(
          ids.map((id, idx) => prisma.organizationRecommendation.update({ where: { id }, data: { position: idx } })),
        )
        return { status: true, data: true }
      },
      {
        body: t.Object({ ids: t.Array(t.Number()) }),
        response: t.Object({ status: t.Boolean(), data: t.Any() }),
      },
    )
    // Eliminar.
    .delete(
      '/api/organization/recommendation/:id',
      async ({ user, organizationId, params }) => {
        assertStaff(user, organizationId)
        const rec = await prisma.organizationRecommendation.findUnique({ where: { id: Number.parseInt(params.id) } })
        if (!rec || rec.organizationId !== organizationId) throw new Error('Recomendación no encontrada.')
        await prisma.organizationRecommendation.delete({ where: { id: rec.id } })
        return { status: true, data: true }
      },
      { params: t.Object({ id: t.String() }), response: t.Object({ status: t.Boolean(), data: t.Any() }) },
    )
