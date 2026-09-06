import { Elysia, t } from 'elysia'
import { prisma } from '../../models/prisma'
import { logged, loggedOptional, loggedUserOnly } from '../../plugins/auth'

const MAX_CONTENT = 4000
const MAX_IMAGES = 4
const MAX_COMMENT = 600

function isStaff(user: any, organizationId: number): boolean {
  return !!user?.permissions?.find((p: any) => p.organizationId === organizationId)?.canSeeAdminPanel
}

function toImages(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x) => typeof x === 'string' && x.length < 512).slice(0, MAX_IMAGES)
}

const postSelect = {
  id: true, content: true, images: true, pinned: true, likesCount: true,
  commentsCount: true, createdAt: true, updatedAt: true, organizationId: true,
  user: { select: { username: true, slug: true, imageUrl: true } },
  organization: { select: { slug: true, name: true, faviconUrl: true, imageUrl: true, isNSFW: true } },
}

function shape(p: any, likedSet: Set<number>) {
  return {
    id: p.id,
    content: p.content,
    images: toImages(p.images),
    pinned: p.pinned,
    likesCount: p.likesCount,
    commentsCount: p.commentsCount,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    liked: likedSet.has(p.id),
    author: p.user ? { username: p.user.username, slug: p.user.slug, imageUrl: p.user.imageUrl } : null,
    org: p.organization
      ? { slug: p.organization.slug, name: p.organization.name, faviconUrl: p.organization.faviconUrl, imageUrl: p.organization.imageUrl, isNSFW: p.organization.isNSFW }
      : null,
  }
}

async function likedSetFor(userId: number | undefined, postIds: number[]): Promise<Set<number>> {
  if (!userId || !postIds.length) return new Set()
  const likes = await prisma.organizationPostLike.findMany({ where: { userId, postId: { in: postIds } }, select: { postId: true } })
  return new Set(likes.map((l) => l.postId))
}

// ---- Rutas publicas / de lectura ----
const publicPart = () =>
  new Elysia()
    .use(loggedOptional())
    .get('/api/organizations/:slug/posts', async ({ params, query, user }: any) => {
      const org = await prisma.organization.findFirst({ where: { slug: params.slug }, select: { id: true } })
      if (!org) return { status: true, data: { items: [], hasMore: false } }
      const limit = Math.min(20, Math.max(1, Number(query.limit) || 10))
      const page = Math.max(0, Number(query.page) || 0)
      const rows = await prisma.organizationPost.findMany({
        where: { organizationId: org.id, deletedAt: null, hiddenAt: null },
        orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
        skip: page * limit, take: limit + 1, select: postSelect,
      })
      const hasMore = rows.length > limit
      const items = rows.slice(0, limit)
      const liked = await likedSetFor(user?.id, items.map((p) => p.id))
      return { status: true, data: { items: items.map((p) => shape(p, liked)), hasMore } }
    })
    .get('/api/socials/feed', async ({ query, user }: any) => {
      const limit = Math.min(20, Math.max(1, Number(query.limit) || 10))
      const page = Math.max(0, Number(query.page) || 0)
      const includeNsfw = query.nsfw === '1' || query.nsfw === 'true'
      const discover = query.scope === 'discover'
      const where: any = { deletedAt: null, hiddenAt: null }
      if (user && !discover) {
        const f = await prisma.organizationFollower.findMany({ where: { userId: user.id }, select: { organizationId: true } })
        const ids = f.map((x) => x.organizationId)
        if (ids.length) where.organizationId = { in: ids }
      }
      if (!includeNsfw) where.organization = { isNSFW: false }
      const rows = await prisma.organizationPost.findMany({
        where, orderBy: [{ createdAt: 'desc' }], skip: page * limit, take: limit + 1, select: postSelect,
      })
      const hasMore = rows.length > limit
      const items = rows.slice(0, limit)
      const liked = await likedSetFor(user?.id, items.map((p) => p.id))
      return { status: true, data: { items: items.map((p) => shape(p, liked)), hasMore, following: !!(user && where.organizationId) } }
    })
    .get('/api/posts/:id', async ({ params, user }: any) => {
      const id = Number(params.id)
      if (!Number.isFinite(id)) return { status: false, message: 'Id invalido.' }
      const p = await prisma.organizationPost.findFirst({ where: { id, deletedAt: null, hiddenAt: null }, select: postSelect })
      if (!p) return { status: false, message: 'No encontrada.' }
      const liked = await likedSetFor(user?.id, [p.id])
      return { status: true, data: shape(p, liked) }
    })
    .get('/api/posts/:id/comments', async ({ params }: any) => {
      const id = Number(params.id)
      if (!Number.isFinite(id)) return { status: true, data: [] }
      const rows = await prisma.comment.findMany({
        where: { identifier: `post-${id}`, deletedAt: null, hiddenAt: null },
        orderBy: { createdAt: 'asc' },
        select: { id: true, comment: true, imageUrl: true, createdAt: true, userId: true, user: { select: { username: true, slug: true, imageUrl: true } } },
      })
      return { status: true, data: rows }
    })

// ---- Interacciones de cualquier usuario logueado ----
const interactions = () =>
  new Elysia()
    .use(logged())
    .post('/api/posts/:id/like', async ({ params, user }: any) => {
      const id = Number(params.id)
      const post = await prisma.organizationPost.findFirst({ where: { id, deletedAt: null }, select: { id: true } })
      if (!post) throw new Error('No encontrada.')
      const existing = await prisma.organizationPostLike.findUnique({ where: { postId_userId: { postId: id, userId: user.id } } })
      if (existing) {
        await prisma.$transaction([
          prisma.organizationPostLike.delete({ where: { id: existing.id } }),
          prisma.organizationPost.update({ where: { id }, data: { likesCount: { decrement: 1 } } }),
        ])
        const p = await prisma.organizationPost.findUnique({ where: { id }, select: { likesCount: true } })
        return { status: true, data: { liked: false, likesCount: Math.max(0, p?.likesCount ?? 0) } }
      }
      await prisma.$transaction([
        prisma.organizationPostLike.create({ data: { postId: id, userId: user.id } }),
        prisma.organizationPost.update({ where: { id }, data: { likesCount: { increment: 1 } } }),
      ])
      const p = await prisma.organizationPost.findUnique({ where: { id }, select: { likesCount: true } })
      return { status: true, data: { liked: true, likesCount: p?.likesCount ?? 1 } }
    })
    .post('/api/posts/:id/comments', async ({ params, body, user }: any) => {
      const id = Number(params.id)
      const post = await prisma.organizationPost.findFirst({ where: { id, deletedAt: null }, select: { id: true, organizationId: true } })
      if (!post) throw new Error('No encontrada.')
      const text = (body.comment || '').trim().slice(0, MAX_COMMENT)
      if (text.length < 1) throw new Error('El comentario esta vacio.')
      const c = await prisma.comment.create({
        data: { organizationId: post.organizationId, userId: user.id, identifier: `post-${id}`, comment: text, imageUrl: body.image || null },
        select: { id: true, comment: true, imageUrl: true, createdAt: true, userId: true, user: { select: { username: true, slug: true, imageUrl: true } } },
      })
      await prisma.organizationPost.update({ where: { id }, data: { commentsCount: { increment: 1 } } })
      return { status: true, data: c }
    }, { body: t.Object({ comment: t.String(), image: t.Optional(t.Union([t.String(), t.Null()])) }) })
    .delete('/api/posts/comments/:commentId', async ({ params, user }: any) => {
      const cid = Number(params.commentId)
      const c = await prisma.comment.findUnique({ where: { id: cid }, select: { id: true, userId: true, organizationId: true, identifier: true, deletedAt: true } })
      if (!c || c.deletedAt) throw new Error('No encontrada.')
      const owner = c.userId === user.id
      const staff = isStaff(user, c.organizationId)
      if (!owner && !staff) throw new Error('No autorizado.')
      await prisma.comment.update({ where: { id: cid }, data: { deletedAt: new Date() } })
      const m = /^post-(\d+)$/.exec(c.identifier)
      if (m) await prisma.organizationPost.update({ where: { id: Number(m[1]) }, data: { commentsCount: { decrement: 1 } } }).catch(() => {})
      return { status: true }
    })

// ---- Gestion de posts (staff del scan, requiere x-organization) ----
const staffPart = () =>
  new Elysia()
    .use(loggedUserOnly())
    .post('/api/organization-post', async ({ body, user, organizationId }: any) => {
      if (!isStaff(user, organizationId)) throw new Error('No autorizado.')
      const content = (body.content || '').trim().slice(0, MAX_CONTENT)
      const images = toImages(body.images)
      if (content.length < 1 && images.length === 0) throw new Error('La publicacion esta vacia.')
      const post = await prisma.organizationPost.create({
        data: { organizationId, userId: user.id, content, images, pinned: !!body.pinned },
        select: postSelect,
      })
      return { status: true, data: shape(post, new Set()) }
    }, { body: t.Object({ content: t.String(), images: t.Optional(t.Array(t.String())), pinned: t.Optional(t.Boolean()) }) })
    .patch('/api/organization-post/:id', async ({ params, body, user, organizationId }: any) => {
      const id = Number(params.id)
      const post = await prisma.organizationPost.findFirst({ where: { id, organizationId, deletedAt: null }, select: { id: true } })
      if (!post) throw new Error('No encontrada.')
      if (!isStaff(user, organizationId)) throw new Error('No autorizado.')
      const data: any = {}
      if (body.content !== undefined) data.content = (body.content || '').trim().slice(0, MAX_CONTENT)
      if (body.images !== undefined) data.images = toImages(body.images)
      if (body.pinned !== undefined) data.pinned = !!body.pinned
      const updated = await prisma.organizationPost.update({ where: { id }, data, select: postSelect })
      return { status: true, data: shape(updated, new Set()) }
    }, { body: t.Object({ content: t.Optional(t.String()), images: t.Optional(t.Array(t.String())), pinned: t.Optional(t.Boolean()) }) })
    .delete('/api/organization-post/:id', async ({ params, user, organizationId }: any) => {
      const id = Number(params.id)
      const post = await prisma.organizationPost.findFirst({ where: { id, organizationId, deletedAt: null }, select: { id: true } })
      if (!post) throw new Error('No encontrada.')
      if (!isStaff(user, organizationId)) throw new Error('No autorizado.')
      await prisma.organizationPost.update({ where: { id }, data: { deletedAt: new Date() } })
      return { status: true }
    })

export const router = () => new Elysia().use(publicPart()).use(interactions()).use(staffPart())
