import { Elysia, t } from 'elysia'
import { prisma } from '../../models/prisma'
import { loggedOptional, loggedUserOnlyGlobal } from '../../plugins/auth'
import { assertNotBanned } from '../../util/ban-check'
import { assertRateLimit } from '../../util/rate-limit'

const EMOJIS = ['👍', '❤️', '🔥', '😂', '😢', '😮'] as const

// Resuelve la org dueña del capítulo (para el ban check).
async function chapterOrgId(chapterId: number): Promise<number | null> {
  const ch = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: {
      mangaCustom: { select: { organizationId: true } },
      uploadedByOrganizationId: true
    }
  })
  return ch?.mangaCustom?.organizationId ?? ch?.uploadedByOrganizationId ?? null
}

export const router = () =>
  new Elysia()
    // GET: agregado + mi reacción
    .use(loggedOptional())
    .get(
      '/api/chapter/:chapterId/reactions',
      async ({ params, user }) => {
        const chapterId = Number.parseInt(params.chapterId)
        if (Number.isNaN(chapterId)) throw new Error('Capítulo inválido.')
        const grouped = await prisma.chapterReaction.groupBy({
          by: ['emoji'],
          where: { chapterId },
          _count: true
        })
        const counts = EMOJIS.map((emoji) => ({
          emoji,
          count: grouped.find((g) => g.emoji === emoji)?._count ?? 0
        }))
        let myReaction: string | null = null
        if (user) {
          const mine = await prisma.chapterReaction.findFirst({
            where: { chapterId, userId: user.id },
            select: { emoji: true }
          })
          myReaction = mine?.emoji ?? null
        }
        return { status: true, data: { counts, myReaction } }
      },
      {
        params: t.Object({ chapterId: t.String() }),
        response: t.Object({ status: t.Boolean(), data: t.Any() })
      }
    )
    // PUT: poner/cambiar reacción
    .use(loggedUserOnlyGlobal())
    .put(
      '/api/chapter/:chapterId/reaction',
      async ({ params, body, user }) => {
        const chapterId = Number.parseInt(params.chapterId)
        if (Number.isNaN(chapterId)) throw new Error('Capítulo inválido.')
        assertRateLimit(`${user.id}:react`, 30, 60_000)
        const orgId = await chapterOrgId(chapterId)
        if (orgId)
          await assertNotBanned(user.id, orgId, 'reaccionar en este scan')
        await prisma.chapterReaction.upsert({
          where: { chapterId_userId: { chapterId, userId: user.id } },
          update: { emoji: body.emoji },
          create: { chapterId, userId: user.id, emoji: body.emoji }
        })
        return { status: true, data: true }
      },
      {
        params: t.Object({ chapterId: t.String() }),
        body: t.Object({
          emoji: t.Union(EMOJIS.map((e) => t.Literal(e)))
        }),
        response: t.Object({ status: t.Boolean(), data: t.Any() })
      }
    )
    .delete(
      '/api/chapter/:chapterId/reaction',
      async ({ params, user }) => {
        const chapterId = Number.parseInt(params.chapterId)
        if (Number.isNaN(chapterId)) throw new Error('Capítulo inválido.')
        await prisma.chapterReaction.deleteMany({
          where: { chapterId, userId: user.id }
        })
        return { status: true, data: true }
      },
      {
        params: t.Object({ chapterId: t.String() }),
        response: t.Object({ status: t.Boolean(), data: t.Any() })
      }
    )
