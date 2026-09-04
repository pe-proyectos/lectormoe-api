import { Elysia, t } from 'elysia'
import { logged } from '../../plugins/auth'
import { prisma } from '../../models/prisma'

const FREE_LIMIT = 5
const SUB_LIMIT = 100

async function isSubscriber(userId: number): Promise<boolean> {
  const n = await prisma.subscription.count({ where: { userId, active: true } })
  return n > 0
}

// Rutas autenticadas (mis frases).
const authed = () =>
  new Elysia()
    .use(logged())
    .get('/api/saved-quotes', async ({ user }) => {
      const [items, sub] = await Promise.all([
        prisma.userSavedQuote.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }),
        isSubscriber(user.id),
      ])
      const limit = sub ? SUB_LIMIT : FREE_LIMIT
      return { status: true, data: { items, count: items.length, limit, isSubscriber: sub } }
    })
    .post(
      '/api/saved-quotes',
      async ({ body, user }) => {
        const text = (body.text || '').replace(/\s+/g, ' ').trim().slice(0, 600)
        if (text.length < 8) throw new Error('La frase es demasiado corta.')

        // Dedupe: misma frase, obra y capitulo.
        const existing = await prisma.userSavedQuote.findFirst({
          where: { userId: user.id, mangaSlug: body.mangaSlug, chapterNumber: body.chapterNumber, text },
        })
        if (existing) return { status: true, data: { quote: existing, deduped: true } }

        const [count, sub] = await Promise.all([
          prisma.userSavedQuote.count({ where: { userId: user.id } }),
          isSubscriber(user.id),
        ])
        const limit = sub ? SUB_LIMIT : FREE_LIMIT
        if (count >= limit) throw new Error('QUOTE_LIMIT')

        const quote = await prisma.userSavedQuote.create({
          data: {
            userId: user.id,
            text,
            mangaSlug: body.mangaSlug.slice(0, 256),
            mangaTitle: (body.mangaTitle || '').slice(0, 256),
            chapterNumber: body.chapterNumber,
            displayNumber: body.displayNumber ?? null,
            orgSlug: body.orgSlug ? body.orgSlug.slice(0, 256) : null,
            workType: body.workType ? body.workType.slice(0, 32) : null,
          },
        })
        return { status: true, data: { quote, count: count + 1, limit } }
      },
      {
        body: t.Object({
          text: t.String(),
          mangaSlug: t.String(),
          mangaTitle: t.String(),
          chapterNumber: t.Number(),
          displayNumber: t.Optional(t.Union([t.Number(), t.Null()])),
          orgSlug: t.Optional(t.Union([t.String(), t.Null()])),
          workType: t.Optional(t.Union([t.String(), t.Null()])),
        }),
      }
    )
    .delete('/api/saved-quotes/:id', async ({ params, user }) => {
      const id = Number(params.id)
      if (!Number.isFinite(id)) throw new Error('Id invalido.')
      await prisma.userSavedQuote.deleteMany({ where: { id, userId: user.id } })
      return { status: true }
    })

// Ruta publica: frases de un perfil (respeta privacidad).
const publicPart = () =>
  new Elysia().get('/api/user/profile/:slug/saved-quotes', async ({ params }) => {
    const u = await prisma.user.findFirst({
      where: { slug: params.slug },
      select: { id: true, isPublicProfile: true, savedQuotesPublic: true },
    })
    if (!u || !u.isPublicProfile || !u.savedQuotesPublic) return { status: true, data: [] }
    const items = await prisma.userSavedQuote.findMany({
      where: { userId: u.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return { status: true, data: items }
  })

export const router = () => new Elysia().use(publicPart()).use(authed())
