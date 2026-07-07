import { Elysia, t } from 'elysia'
import { prisma } from '../../models/prisma'
import { loggedUserOnlyGlobal } from '../../plugins/auth'
import { assertRateLimit } from '../../util/rate-limit'

const CATEGORIES = [
  'menores',
  'ilegal',
  'no_etiquetado',
  'spam',
  'otro'
] as const

export const router = () =>
  new Elysia().use(loggedUserOnlyGlobal()).post(
    '/api/reports',
    async ({ user, body }) => {
      assertRateLimit(
        `${user.id}:report`,
        10,
        24 * 60 * 60 * 1000,
        'Has enviado demasiados reportes hoy. Intenta de nuevo mañana.'
      )

      // Resolver objetivo: manga (slug + org) o joint (slug).
      let mangaCustomId: number | null = null
      let jointId: number | null = null
      if (body.jointSlug) {
        const j = await prisma.mangaJoint.findFirst({
          where: { slug: body.jointSlug, deletedAt: null },
          select: { id: true }
        })
        if (!j) throw new Error('Obra no encontrada.')
        jointId = j.id
      } else if (body.mangaSlug && body.organizationSlug) {
        const mc = await prisma.mangaCustom.findFirst({
          where: {
            manga: { slug: body.mangaSlug },
            organization: { slug: body.organizationSlug },
            deletedAt: null
          },
          select: { id: true }
        })
        if (!mc) throw new Error('Obra no encontrada.')
        mangaCustomId = mc.id
      } else {
        throw new Error('Reporte inválido.')
      }

      // No duplicar un reporte pendiente del mismo objetivo por el mismo usuario.
      const existing = await prisma.contentReport.findFirst({
        where: {
          reporterUserId: user.id,
          status: 'pending',
          ...(mangaCustomId ? { mangaCustomId } : { jointId })
        },
        select: { id: true }
      })
      if (existing)
        return {
          status: true,
          data: { message: 'Ya recibimos tu reporte, está en revisión.' }
        }

      await prisma.contentReport.create({
        data: {
          reporterUserId: user.id,
          mangaCustomId,
          jointId,
          category: body.category,
          details: body.details ?? null
        }
      })
      return {
        status: true,
        data: { message: 'Gracias por tu reporte. Nuestro equipo lo revisará.' }
      }
    },
    {
      body: t.Object({
        mangaSlug: t.Optional(t.String()),
        organizationSlug: t.Optional(t.String()),
        jointSlug: t.Optional(t.String()),
        category: t.Union(CATEGORIES.map((c) => t.Literal(c))),
        details: t.Optional(t.Union([t.String({ maxLength: 2000 }), t.Null()]))
      }),
      response: t.Object({ status: t.Boolean(), data: t.Any() })
    }
  )
