import { Elysia, t } from 'elysia'
import { prisma } from '../../models/prisma'
import { loggedUserOnly } from '../../plugins/auth'

async function resolveMc(organizationId: number, mangaSlug: string) {
  return prisma.mangaCustom.findFirst({
    where: { organizationId, manga: { slug: mangaSlug }, deletedAt: null },
    select: { id: true, mangaId: true }
  })
}

async function lastPublishedNumber(mangaId: number): Promise<number> {
  const ch = await prisma.chapter.findFirst({
    where: {
      deletedAt: null,
      isUnreleased: false,
      releasedAt: { not: null, lte: new Date() },
      OR: [
        { mangaCustom: { mangaId, deletedAt: null } },
        { joint: { mangaId, deletedAt: null } }
      ]
    },
    orderBy: { number: 'desc' },
    select: { number: true }
  })
  return ch?.number ?? 0
}

export const router = () =>
  new Elysia()
    .use(loggedUserOnly())
    .get(
      '/api/manga-custom/:mangaSlug/milestone-alert',
      async ({ organizationId, user, params }) => {
        const mc = await resolveMc(organizationId, params.mangaSlug)
        if (!mc) return { status: true, data: null }
        const alert = await prisma.chapterMilestoneAlert.findFirst({
          where: { userId: user.id, mangaCustomId: mc.id }
        })
        return { status: true, data: alert }
      },
      {
        params: t.Object({ mangaSlug: t.String() }),
        response: t.Object({ status: t.Boolean(), data: t.Any() })
      }
    )
    .put(
      '/api/manga-custom/:mangaSlug/milestone-alert',
      async ({ organizationId, user, params, body }) => {
        // Gate de suscriptor activo (cualquier scan).
        const hasSub = await prisma.subscription.findFirst({
          where: { userId: user.id, active: true },
          select: { id: true }
        })
        if (!hasSub)
          throw new Error(
            'Los avisos por capítulo son un beneficio para suscriptores de cualquier scan.'
          )

        const mc = await resolveMc(organizationId, params.mangaSlug)
        if (!mc) throw new Error('Obra no encontrada.')

        const lastNum = await lastPublishedNumber(mc.mangaId)
        if (body.targetNumber <= lastNum) {
          throw new Error(
            `Esa obra ya llegó al capítulo ${lastNum}. Elige un número mayor o empieza a leerla.`
          )
        }

        const alert = await prisma.chapterMilestoneAlert.upsert({
          where: {
            userId_mangaCustomId: { userId: user.id, mangaCustomId: mc.id }
          },
          update: { targetNumber: body.targetNumber, triggeredAt: null },
          create: {
            userId: user.id,
            mangaCustomId: mc.id,
            targetNumber: body.targetNumber
          }
        })
        return { status: true, data: alert }
      },
      {
        params: t.Object({ mangaSlug: t.String() }),
        body: t.Object({ targetNumber: t.Number({ minimum: 1 }) }),
        response: t.Object({ status: t.Boolean(), data: t.Any() })
      }
    )
    .delete(
      '/api/manga-custom/:mangaSlug/milestone-alert',
      async ({ organizationId, user, params }) => {
        const mc = await resolveMc(organizationId, params.mangaSlug)
        if (!mc) return { status: true, data: true }
        await prisma.chapterMilestoneAlert.deleteMany({
          where: { userId: user.id, mangaCustomId: mc.id }
        })
        return { status: true, data: true }
      },
      {
        params: t.Object({ mangaSlug: t.String() }),
        response: t.Object({ status: t.Boolean(), data: t.Any() })
      }
    )
