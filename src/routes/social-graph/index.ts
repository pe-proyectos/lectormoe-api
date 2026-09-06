import { Elysia, t } from 'elysia'
import { prisma } from '../../models/prisma'
import { logged, loggedOptional } from '../../plugins/auth'
import { notifySocial } from '../../util/social-notify'
import { assertRateLimit } from '../../util/rate-limit'

async function userBySlug(slug: string) {
  return prisma.user.findFirst({ where: { slug }, select: { id: true, username: true, slug: true, imageUrl: true, bannerUrl: true, description: true, followersCount: true, followingCount: true, postsCount: true } })
}
async function notify(recipient: number, type: string, actorUserId: number) {
  await notifySocial({ userId: recipient, type, actorUserId })
}

// ---------- Perfil social (público) ----------
const publicPart = () =>
  new Elysia()
    .use(loggedOptional())
    .get('/api/users/:slug/social', async ({ params, user }: any) => {
      const u = await userBySlug(params.slug)
      if (!u) return { status: false, message: 'No encontrado.' }
      let isFollowing = false, isBlocked = false, isMuted = false, followsMe = false
      if (user && user.id !== u.id) {
        const [f, b, m, fm] = await Promise.all([
          prisma.userFollow.findUnique({ where: { followerId_followedId: { followerId: user.id, followedId: u.id } } }),
          prisma.userBlock.findUnique({ where: { blockerId_blockedId: { blockerId: user.id, blockedId: u.id } } }),
          prisma.userMute.findUnique({ where: { muterId_mutedId: { muterId: user.id, mutedId: u.id } } }),
          prisma.userFollow.findUnique({ where: { followerId_followedId: { followerId: u.id, followedId: user.id } } }),
        ])
        isFollowing = !!f; isBlocked = !!b; isMuted = !!m; followsMe = !!fm
      }
      return { status: true, data: { ...u, isFollowing, isBlocked, isMuted, followsMe, isSelf: user?.id === u.id } }
    })
    .get('/api/users/:slug/followers', async ({ params, query }: any) => {
      const u = await userBySlug(params.slug); if (!u) return { status: true, data: { items: [], hasMore: false } }
      const limit = 20, page = Math.max(0, Number(query.page) || 0)
      const rows = await prisma.userFollow.findMany({ where: { followedId: u.id }, orderBy: { createdAt: 'desc' }, skip: page * limit, take: limit + 1, select: { followerId: true } })
      const ids = rows.slice(0, limit).map((r) => r.followerId)
      const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { username: true, slug: true, imageUrl: true, description: true } })
      return { status: true, data: { items: users, hasMore: rows.length > limit } }
    })
    .get('/api/users/:slug/following', async ({ params, query }: any) => {
      const u = await userBySlug(params.slug); if (!u) return { status: true, data: { items: [], hasMore: false } }
      const limit = 20, page = Math.max(0, Number(query.page) || 0)
      const rows = await prisma.userFollow.findMany({ where: { followerId: u.id }, orderBy: { createdAt: 'desc' }, skip: page * limit, take: limit + 1, select: { followedId: true } })
      const ids = rows.slice(0, limit).map((r) => r.followedId)
      const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { username: true, slug: true, imageUrl: true, description: true } })
      return { status: true, data: { items: users, hasMore: rows.length > limit } }
    })

// ---------- Acciones (logueado) ----------
const actions = () =>
  new Elysia()
    .use(logged())
    .post('/api/users/:slug/follow', async ({ params, user }: any) => {
      assertRateLimit(`follow:${user.id}`, 100, 3600 * 1000, 'Demasiadas acciones, espera un momento.')
      const u = await prisma.user.findFirst({ where: { slug: params.slug }, select: { id: true } })
      if (!u) throw new Error('No encontrado.')
      if (u.id === user.id) throw new Error('No puedes seguirte a ti mismo.')
      const existing = await prisma.userFollow.findUnique({ where: { followerId_followedId: { followerId: user.id, followedId: u.id } } })
      if (existing) {
        await prisma.$transaction([
          prisma.userFollow.delete({ where: { id: existing.id } }),
          prisma.user.update({ where: { id: u.id }, data: { followersCount: { decrement: 1 } } }),
          prisma.user.update({ where: { id: user.id }, data: { followingCount: { decrement: 1 } } }),
        ])
        return { status: true, data: { following: false } }
      }
      // No permitir seguir si hay bloqueo en cualquier direccion.
      const blocked = await prisma.userBlock.findFirst({ where: { OR: [{ blockerId: user.id, blockedId: u.id }, { blockerId: u.id, blockedId: user.id }] }, select: { id: true } })
      if (blocked) throw new Error('No disponible.')
      await prisma.$transaction([
        prisma.userFollow.create({ data: { followerId: user.id, followedId: u.id } }),
        prisma.user.update({ where: { id: u.id }, data: { followersCount: { increment: 1 } } }),
        prisma.user.update({ where: { id: user.id }, data: { followingCount: { increment: 1 } } }),
      ])
      await notify(u.id, 'user_follow', user.id)
      return { status: true, data: { following: true } }
    })
    .post('/api/users/:slug/block', async ({ params, user }: any) => {
      const u = await prisma.user.findFirst({ where: { slug: params.slug }, select: { id: true } })
      if (!u || u.id === user.id) throw new Error('No disponible.')
      const existing = await prisma.userBlock.findUnique({ where: { blockerId_blockedId: { blockerId: user.id, blockedId: u.id } } })
      if (existing) { await prisma.userBlock.delete({ where: { id: existing.id } }); return { status: true, data: { blocked: false } } }
      // Bloquear elimina follows mutuos y ajusta contadores.
      const [f1, f2] = await Promise.all([
        prisma.userFollow.findUnique({ where: { followerId_followedId: { followerId: user.id, followedId: u.id } } }),
        prisma.userFollow.findUnique({ where: { followerId_followedId: { followerId: u.id, followedId: user.id } } }),
      ])
      const ops: any[] = [prisma.userBlock.create({ data: { blockerId: user.id, blockedId: u.id } })]
      if (f1) { ops.push(prisma.userFollow.delete({ where: { id: f1.id } }), prisma.user.update({ where: { id: u.id }, data: { followersCount: { decrement: 1 } } }), prisma.user.update({ where: { id: user.id }, data: { followingCount: { decrement: 1 } } })) }
      if (f2) { ops.push(prisma.userFollow.delete({ where: { id: f2.id } }), prisma.user.update({ where: { id: user.id }, data: { followersCount: { decrement: 1 } } }), prisma.user.update({ where: { id: u.id }, data: { followingCount: { decrement: 1 } } })) }
      await prisma.$transaction(ops)
      return { status: true, data: { blocked: true } }
    })
    .post('/api/users/:slug/mute', async ({ params, user }: any) => {
      const u = await prisma.user.findFirst({ where: { slug: params.slug }, select: { id: true } })
      if (!u || u.id === user.id) throw new Error('No disponible.')
      const existing = await prisma.userMute.findUnique({ where: { muterId_mutedId: { muterId: user.id, mutedId: u.id } } })
      if (existing) { await prisma.userMute.delete({ where: { id: existing.id } }); return { status: true, data: { muted: false } } }
      await prisma.userMute.create({ data: { muterId: user.id, mutedId: u.id } })
      return { status: true, data: { muted: true } }
    })
    .post('/api/posts/:id/report', async ({ params, body, user }: any) => {
      assertRateLimit(`report:${user.id}`, 15, 24 * 3600 * 1000, 'Alcanzaste el límite de reportes.')
      const id = Number(params.id)
      const post = await prisma.organizationPost.findFirst({ where: { id, deletedAt: null }, select: { id: true, userId: true } })
      if (!post) throw new Error('No encontrada.')
      const cat = ['spam', 'harassment', 'nsfw_unmarked', 'spoiler_unmarked', 'illegal', 'other'].includes(body.category) ? body.category : 'other'
      const dup = await prisma.contentReport.findFirst({ where: { reporterUserId: user.id, postId: id }, select: { id: true } })
      if (dup) return { status: true, data: { reported: true, deduped: true } }
      await prisma.contentReport.create({ data: { reporterUserId: user.id, postId: id, reportedUserId: post.userId, category: cat, details: (body.details || '').slice(0, 2000) || null } })
      const updated = await prisma.organizationPost.update({ where: { id }, data: { reportsCount: { increment: 1 } }, select: { reportsCount: true } })
      // Auto shadow-hide al alcanzar 5 reportes.
      if (updated.reportsCount >= 5) await prisma.organizationPost.update({ where: { id }, data: { hiddenAt: new Date(), hiddenReason: 'auto_reports' } }).catch(() => {})
      return { status: true, data: { reported: true } }
    }, { body: t.Object({ category: t.Optional(t.String()), details: t.Optional(t.String()) }) })

export const router = () => new Elysia().use(publicPart()).use(actions())
