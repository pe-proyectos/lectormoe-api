import { Elysia, t } from 'elysia'
import { prisma } from '../../models/prisma'
import { loggedOptional, loggedUserOnly } from '../../plugins/auth'
import { assertNotBanned } from '../../util/ban-check'
import { assertRateLimit } from '../../util/rate-limit'

async function resolveMc(organizationId: number, mangaSlug: string) {
  return prisma.mangaCustom.findFirst({
    where: { organizationId, manga: { slug: mangaSlug }, deletedAt: null },
    select: { id: true }
  })
}

const userSelect = { id: true, username: true, slug: true, imageUrl: true }

export const router = () =>
  new Elysia()
    .use(loggedOptional())
    .get(
      '/api/manga-custom/:mangaSlug/reviews',
      async ({ organizationId, user, params, query }) => {
        const mc = organizationId
          ? await resolveMc(organizationId, params.mangaSlug)
          : null
        if (!mc)
          return {
            status: true,
            data: {
              reviews: [],
              average: null,
              count: 0,
              distribution: {},
              myReview: null
            }
          }
        const page = query?.page ? Number.parseInt(query.page) : 1
        const limit = 10
        const [reviews, grouped, myReview] = await Promise.all([
          prisma.mangaReview.findMany({
            where: { mangaCustomId: mc.id, hiddenAt: null },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
            include: { user: { select: userSelect } }
          }),
          prisma.mangaReview.groupBy({
            by: ['rating'],
            where: { mangaCustomId: mc.id, hiddenAt: null },
            _count: true
          }),
          user
            ? prisma.mangaReview.findFirst({
                where: { mangaCustomId: mc.id, userId: user.id }
              })
            : Promise.resolve(null)
        ])
        const distribution: Record<string, number> = {
          '1': 0,
          '2': 0,
          '3': 0,
          '4': 0,
          '5': 0
        }
        let total = 0
        let sum = 0
        for (const g of grouped) {
          distribution[String(g.rating)] = g._count
          total += g._count
          sum += g.rating * g._count
        }
        return {
          status: true,
          data: {
            reviews,
            average: total > 0 ? sum / total : null,
            count: total,
            distribution,
            myReview
          }
        }
      },
      {
        params: t.Object({ mangaSlug: t.String() }),
        query: t.Optional(t.Object({ page: t.Optional(t.String()) })),
        response: t.Object({ status: t.Boolean(), data: t.Any() })
      }
    )
    .use(loggedUserOnly())
    .put(
      '/api/manga-custom/:mangaSlug/reviews',
      async ({ organizationId, user, params, body }) => {
        assertRateLimit(`${user.id}:review`, 10, 60_000)
        await assertNotBanned(
          user.id,
          organizationId,
          'dejar reseñas en este scan'
        )
        const hasSub = await prisma.subscription.findFirst({
          where: { userId: user.id, active: true },
          select: { id: true }
        })
        if (!hasSub)
          throw new Error(
            'Las reseñas son un beneficio para suscriptores de cualquier scan.'
          )
        const mc = await resolveMc(organizationId, params.mangaSlug)
        if (!mc) throw new Error('Obra no encontrada.')
        // Al editar la propia reseña, solo se limpia hiddenAt si NO la ocultó el staff.
        const existing = await prisma.mangaReview.findFirst({
          where: { userId: user.id, mangaCustomId: mc.id },
          select: { hiddenAt: true, hiddenByUserId: true }
        })
        const clearHidden =
          existing && existing.hiddenAt && existing.hiddenByUserId === user.id
        const review = await prisma.mangaReview.upsert({
          where: {
            userId_mangaCustomId: { userId: user.id, mangaCustomId: mc.id }
          },
          update: {
            rating: body.rating,
            body: body.body ?? null,
            ...(clearHidden ? { hiddenAt: null, hiddenByUserId: null } : {})
          },
          create: {
            userId: user.id,
            mangaCustomId: mc.id,
            rating: body.rating,
            body: body.body ?? null
          }
        })
        return { status: true, data: review }
      },
      {
        params: t.Object({ mangaSlug: t.String() }),
        body: t.Object({
          rating: t.Integer({ minimum: 1, maximum: 5 }),
          body: t.Optional(t.Union([t.String({ maxLength: 500 }), t.Null()]))
        }),
        response: t.Object({ status: t.Boolean(), data: t.Any() })
      }
    )
    .delete(
      '/api/manga-custom/:mangaSlug/reviews',
      async ({ organizationId, user, params }) => {
        const mc = await resolveMc(organizationId, params.mangaSlug)
        if (!mc) return { status: true, data: true }
        await prisma.mangaReview.deleteMany({
          where: { userId: user.id, mangaCustomId: mc.id }
        })
        return { status: true, data: true }
      },
      {
        params: t.Object({ mangaSlug: t.String() }),
        response: t.Object({ status: t.Boolean(), data: t.Any() })
      }
    )
    .patch(
      '/api/manga-custom/:mangaSlug/reviews/:id/hide',
      async ({ organizationId, user, params }) => {
        const perm = user.permissions?.find(
          (p: any) => p.organizationId === organizationId
        )
        if (!perm?.canHideComment)
          throw new Error('No tienes permisos para moderar reseñas.')
        await prisma.mangaReview.update({
          where: { id: Number.parseInt(params.id) },
          data: { hiddenAt: new Date(), hiddenByUserId: user.id }
        })
        return { status: true, data: true }
      },
      {
        params: t.Object({ mangaSlug: t.String(), id: t.String() }),
        response: t.Object({ status: t.Boolean(), data: t.Any() })
      }
    )
