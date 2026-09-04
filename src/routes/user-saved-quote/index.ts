import { Elysia, t } from 'elysia'
import { logged } from '../../plugins/auth'
import { prisma } from '../../models/prisma'
import { renderOgPng } from './ogRender'

const FREE_LIMIT = 5
const SUB_LIMIT = 100

async function isSubscriber(userId: number): Promise<boolean> {
  const n = await prisma.subscription.count({ where: { userId, active: true } })
  return n > 0
}

function sanitizeConfig(cfg: unknown): any {
  if (!cfg || typeof cfg !== 'object') return null
  try {
    const s = JSON.stringify(cfg)
    if (s.length > 2000) return null
    return JSON.parse(s)
  } catch { return null }
}

// Rutas autenticadas (mis frases).
const authed = () =>
  new Elysia()
    .use(logged())
    .get('/api/saved-quotes', async ({ user }) => {
      const [items, sub] = await Promise.all([
        prisma.userSavedQuote.findMany({
          where: { userId: user.id },
          orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
        }),
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

        const [count, sub, top] = await Promise.all([
          prisma.userSavedQuote.count({ where: { userId: user.id } }),
          isSubscriber(user.id),
          prisma.userSavedQuote.findFirst({ where: { userId: user.id }, orderBy: { position: 'desc' }, select: { position: true } }),
        ])
        const limit = sub ? SUB_LIMIT : FREE_LIMIT
        if (count >= limit) throw new Error('QUOTE_LIMIT')

        const quote = await prisma.userSavedQuote.create({
          data: {
            userId: user.id,
            text,
            note: body.note ? body.note.slice(0, 500) : null,
            cardConfig: sanitizeConfig(body.cardConfig) ?? undefined,
            position: (top?.position ?? count - 1) + 1,
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
          note: t.Optional(t.Union([t.String(), t.Null()])),
          cardConfig: t.Optional(t.Any()),
          mangaSlug: t.String(),
          mangaTitle: t.String(),
          chapterNumber: t.Number(),
          displayNumber: t.Optional(t.Union([t.Number(), t.Null()])),
          orgSlug: t.Optional(t.Union([t.String(), t.Null()])),
          workType: t.Optional(t.Union([t.String(), t.Null()])),
        }),
      }
    )
    .patch(
      '/api/saved-quotes/:id',
      async ({ params, body, user }) => {
        const id = Number(params.id)
        if (!Number.isFinite(id)) throw new Error('Id invalido.')
        const owned = await prisma.userSavedQuote.findFirst({ where: { id, userId: user.id }, select: { id: true } })
        if (!owned) throw new Error('No encontrada.')
        const data: any = {}
        if (body.note !== undefined) data.note = body.note ? body.note.slice(0, 500) : null
        if (body.cardConfig !== undefined) data.cardConfig = sanitizeConfig(body.cardConfig) ?? undefined
        const quote = await prisma.userSavedQuote.update({ where: { id }, data })
        return { status: true, data: { quote } }
      },
      { body: t.Object({ note: t.Optional(t.Union([t.String(), t.Null()])), cardConfig: t.Optional(t.Any()) }) }
    )
    .patch(
      '/api/saved-quotes/reorder',
      async ({ body, user }) => {
        const ids = (body.ids || []).map(Number).filter((n) => Number.isFinite(n)).slice(0, 200)
        const owned = await prisma.userSavedQuote.findMany({ where: { id: { in: ids }, userId: user.id }, select: { id: true } })
        const ownedSet = new Set(owned.map((o) => o.id))
        const ops = ids.filter((id) => ownedSet.has(id)).map((id, i) => prisma.userSavedQuote.update({ where: { id }, data: { position: i } }))
        await prisma.$transaction(ops)
        return { status: true }
      },
      { body: t.Object({ ids: t.Array(t.Number()) }) }
    )
    .delete('/api/saved-quotes/:id', async ({ params, user }) => {
      const id = Number(params.id)
      if (!Number.isFinite(id)) throw new Error('Id invalido.')
      await prisma.userSavedQuote.deleteMany({ where: { id, userId: user.id } })
      return { status: true }
    })

// Rutas publicas.
const publicPart = () =>
  new Elysia()
    .get('/api/user/profile/:slug/saved-quotes', async ({ params }) => {
      const u = await prisma.user.findFirst({
        where: { slug: params.slug },
        select: { id: true, isPublicProfile: true, savedQuotesPublic: true },
      })
      if (!u || !u.isPublicProfile || !u.savedQuotesPublic) return { status: true, data: [] }
      const items = await prisma.userSavedQuote.findMany({
        where: { userId: u.id },
        orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
        take: 100,
      })
      return { status: true, data: items }
    })
    // Cita individual (para la pagina /cita/:id y sus meta tags).
    .get('/api/quotes/:id', async ({ params }) => {
      const id = Number(params.id)
      if (!Number.isFinite(id)) return { status: false, message: 'Id invalido.' }
      const q = await prisma.userSavedQuote.findUnique({
        where: { id },
        include: { user: { select: { username: true, slug: true } } },
      })
      if (!q) return { status: false, message: 'No encontrada.' }
      let scanName: string | null = null
      if (q.orgSlug) {
        const org = await prisma.organization.findFirst({ where: { slug: q.orgSlug }, select: { name: true } })
        scanName = org?.name ?? null
      }
      return {
        status: true,
        data: {
          id: q.id,
          text: q.text,
          note: q.note,
          cardConfig: q.cardConfig,
          mangaSlug: q.mangaSlug,
          mangaTitle: q.mangaTitle,
          chapterNumber: q.chapterNumber,
          displayNumber: q.displayNumber,
          orgSlug: q.orgSlug,
          workType: q.workType,
          username: q.user?.username ?? null,
          userSlug: q.user?.slug ?? null,
          scanName,
        },
      }
    })
    // Imagen og de la cita (1200x630 PNG).
    .get('/api/quotes/:id/og.png', async ({ params, set }) => {
      const id = Number(params.id)
      const q = Number.isFinite(id)
        ? await prisma.userSavedQuote.findUnique({ where: { id }, include: { user: { select: { username: true } } } })
        : null
      if (!q) { set.status = 404; return 'not found' }
      let scanName: string | null = null
      if (q.orgSlug) {
        const org = await prisma.organization.findFirst({ where: { slug: q.orgSlug }, select: { name: true } })
        scanName = org?.name ?? null
      }
      const cfg = (q.cardConfig && typeof q.cardConfig === 'object' ? q.cardConfig : {}) as any
      const chapterLabel = `Capitulo ${q.displayNumber ?? q.chapterNumber}`
      const buf = renderOgPng({
        text: q.text, title: q.mangaTitle, chapterLabel, scanName,
        username: q.user?.username ?? null, config: cfg,
      })
      set.headers['content-type'] = 'image/png'
      set.headers['cache-control'] = 'public, max-age=86400'
      return new Response(buf)
    })

export const router = () => new Elysia().use(publicPart()).use(authed())
