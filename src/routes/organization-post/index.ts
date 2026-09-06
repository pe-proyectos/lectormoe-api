import { Elysia, t } from 'elysia'
import { prisma } from '../../models/prisma'
import { logged, loggedOptional } from '../../plugins/auth'
import { notifySocial } from '../../util/social-notify'
import { assertRateLimit } from '../../util/rate-limit'

const forYouCache = new Map<string, { ids: number[]; ts: number }>()
const FORYOU_TTL = 90 * 1000

const MAX_CONTENT = 5000
const MAX_IMAGES = 4

function isStaff(user: any, organizationId: number | null): boolean {
  if (!organizationId) return false
  return !!user?.permissions?.find((p: any) => p.organizationId === organizationId)?.canSeeAdminPanel
}
function toImages(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x) => typeof x === 'string' && x.length < 512).slice(0, MAX_IMAGES)
}
function parseHashtags(content: string): string[] {
  const out = new Set<string>()
  for (const m of content.matchAll(/#([\p{L}\p{N}_]{1,80})/gu)) out.add(m[1].toLowerCase())
  return [...out].slice(0, 10)
}
function parseMentions(content: string): string[] {
  const out = new Set<string>()
  for (const m of content.matchAll(/@([a-zA-Z0-9_]{1,30})/g)) out.add(m[1])
  return [...out].slice(0, 10)
}

const authorInclude = {
  user: { select: { username: true, slug: true, imageUrl: true } },
  organization: { select: { slug: true, name: true, faviconUrl: true, imageUrl: true, isNSFW: true } },
}
const postSelect = {
  id: true, content: true, images: true, pinned: true, parentId: true, repostOfId: true,
  likesCount: true, commentsCount: true, repostCount: true, createdAt: true, organizationId: true, userId: true,
  isSpoiler: true, isSensitive: true, spoilerOfMangaCustomId: true, spoilerChapter: true, workMangaCustomId: true,
  poll: { select: { id: true, options: true, votesCount: true, endsAt: true } },
  ...authorInclude,
}

function authorOf(p: any) {
  if (p.organizationId && p.organization) {
    return { kind: 'scan', name: p.organization.name, slug: p.organization.slug,
      avatar: p.organization.faviconUrl || p.organization.imageUrl || null, isNSFW: p.organization.isNSFW,
      byUser: p.user?.username || null }
  }
  return { kind: 'user', name: p.user?.username || '—', slug: p.user?.slug || null, avatar: p.user?.imageUrl || null, isNSFW: false, byUser: null }
}

interface ViewerSets { likes: Set<number>; saves: Set<number>; reposts: Set<number> }
async function viewerSets(userId: number | undefined, postIds: number[]): Promise<ViewerSets> {
  if (!userId || !postIds.length) return { likes: new Set(), saves: new Set(), reposts: new Set() }
  const [likes, saves, reposts] = await Promise.all([
    prisma.organizationPostLike.findMany({ where: { userId, postId: { in: postIds } }, select: { postId: true } }),
    prisma.organizationPostSave.findMany({ where: { userId, postId: { in: postIds } }, select: { postId: true } }),
    prisma.organizationPost.findMany({ where: { userId, repostOfId: { in: postIds }, content: '', deletedAt: null }, select: { repostOfId: true } }),
  ])
  return {
    likes: new Set(likes.map((l) => l.postId)),
    saves: new Set(saves.map((s) => s.postId)),
    reposts: new Set(reposts.map((r) => r.repostOfId!).filter(Boolean)),
  }
}

function normalizePollOptions(o: any): any[] {
  if (typeof o === 'string') { try { o = JSON.parse(o) } catch { return [] } }
  return Array.isArray(o) ? o : []
}
function shape(p: any, v: ViewerSets, repostOf?: any): any {
  return {
    id: p.id, content: p.content, images: toImages(p.images), pinned: p.pinned,
    parentId: p.parentId ?? null, isReply: !!p.parentId,
    likesCount: p.likesCount, commentsCount: p.commentsCount, repostCount: p.repostCount,
    isSpoiler: !!p.isSpoiler, isSensitive: !!p.isSensitive,
    spoilerOfMangaCustomId: p.spoilerOfMangaCustomId ?? null, spoilerChapter: p.spoilerChapter ?? null,
    spoilerSafe: false, spoilerWork: null, work: null,
    _workId: p.workMangaCustomId ?? null,
    createdAt: p.createdAt,
    liked: v.likes.has(p.id), saved: v.saves.has(p.id), reposted: v.reposts.has(p.id),
    author: authorOf(p),
    poll: p.poll ? { id: p.poll.id, options: normalizePollOptions(p.poll.options), votesCount: p.poll.votesCount, endsAt: p.poll.endsAt, myVote: null } : null,
    repostOf: repostOf === undefined ? null : repostOf,
  }
}

// Adjunta el post citado (repostOf) a cada item, un solo nivel.
async function hydratePolls(items: any[], userId?: number) {
  if (!userId) return
  const pollIds = items.map((x) => x.poll?.id).filter(Boolean) as number[]
  if (!pollIds.length) return
  const votes = await prisma.postPollVote.findMany({ where: { userId, pollId: { in: pollIds } }, select: { pollId: true, optionIndex: true } })
  const vm = new Map(votes.map((x) => [x.pollId, x.optionIndex]))
  for (const x of items) if (x.poll) x.poll.myVote = vm.get(x.poll.id) ?? null
}
async function withReposts(rows: any[], v: ViewerSets, userId?: number): Promise<any[]> {
  const targetIds = [...new Set(rows.map((r) => r.repostOfId).filter(Boolean))] as number[]
  let shaped: any[]
  if (!targetIds.length) shaped = rows.map((r) => shape(r, v))
  else {
    const targets = await prisma.organizationPost.findMany({ where: { id: { in: targetIds }, deletedAt: null }, select: postSelect })
    const tv = await viewerSets(userId, targets.map((t) => t.id))
    const map = new Map(targets.map((t) => [t.id, shape(t, tv)]))
    shaped = rows.map((r) => shape(r, v, r.repostOfId ? map.get(r.repostOfId) ?? null : undefined))
  }
  await hydratePolls(shaped, userId)
  await hydrateSpoilers(shaped, userId)
  await hydrateWorks(shaped)
  return shaped
}

async function hydrateWorks(items: any[]) {
  const ids = [...new Set(items.map((x) => x._workId).filter(Boolean))] as number[]
  if (ids.length) {
    const works = await prisma.mangaCustom.findMany({ where: { id: { in: ids } }, select: { id: true, title: true, imageUrl: true, isNSFW: true, manga: { select: { slug: true } }, organization: { select: { slug: true, isNSFW: true } } } })
    const map = new Map(works.map((w) => [w.id, w]))
    for (const x of items) {
      if (!x._workId) { delete x._workId; continue }
      const w = map.get(x._workId)
      x.work = w ? { title: w.title, imageUrl: w.imageUrl, mangaSlug: w.manga?.slug ?? null, orgSlug: w.organization?.slug ?? null, isNSFW: w.isNSFW || w.organization?.isNSFW || false } : null
      delete x._workId
    }
  } else { for (const x of items) delete x._workId }
}

async function hydrateSpoilers(items: any[], userId?: number) {
  const spoilerItems = items.filter((x) => x.isSpoiler && x.spoilerOfMangaCustomId)
  if (!spoilerItems.length) return
  const mangaIds = [...new Set(spoilerItems.map((x) => x.spoilerOfMangaCustomId))] as number[]
  const works = await prisma.mangaCustom.findMany({ where: { id: { in: mangaIds } }, select: { id: true, title: true } })
  const titleMap = new Map(works.map((w) => [w.id, w.title]))
  let maxRead = new Map<number, number>()
  if (userId) {
    const hist = await prisma.userChapterHistory.findMany({
      where: { userId, chapter: { mangaCustomId: { in: mangaIds } } },
      select: { chapter: { select: { mangaCustomId: true, number: true } } },
    })
    for (const h of hist) {
      const mid = h.chapter?.mangaCustomId; if (!mid) continue
      maxRead.set(mid, Math.max(maxRead.get(mid) ?? 0, h.chapter?.number ?? 0))
    }
  }
  for (const x of spoilerItems) {
    const mid = x.spoilerOfMangaCustomId
    x.spoilerWork = { mangaCustomId: mid, title: titleMap.get(mid) ?? null, chapter: x.spoilerChapter ?? null }
    if (x.spoilerChapter != null && (maxRead.get(mid) ?? -1) >= x.spoilerChapter) x.spoilerSafe = true
  }
}

// Conjunto de userIds que el viewer no debe ver (bloqueos en cualquier direccion + silenciados).
async function excludedAuthorIds(viewerId: number | undefined): Promise<number[]> {
  if (!viewerId) return []
  const [blocks, muted] = await Promise.all([
    prisma.userBlock.findMany({ where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] }, select: { blockerId: true, blockedId: true } }),
    prisma.userMute.findMany({ where: { muterId: viewerId }, select: { mutedId: true } }),
  ])
  const set = new Set<number>()
  for (const b of blocks) { set.add(b.blockerId === viewerId ? b.blockedId : b.blockerId) }
  for (const m of muted) set.add(m.mutedId)
  return [...set]
}

async function notify(recipientUserId: number | null | undefined, type: string, postId: number, actorUserId: number, orgId: number | null = null) {
  await notifySocial({ userId: recipientUserId, type, actorUserId, postId, organizationId: orgId })
}
async function notifyMentions(content: string, postId: number, actorUserId: number) {
  const names = parseMentions(content)
  if (!names.length) return
  const users = await prisma.user.findMany({ where: { username: { in: names } }, select: { id: true } })
  await Promise.all(users.map((u) => notify(u.id, 'post_mention', postId, actorUserId)))
}

async function rankForYou(userId: number | undefined, includeNsfw: boolean, excluded: number[]): Promise<number[]> {
  const key = `foryou:${userId ?? 'anon'}:${includeNsfw ? 1 : 0}`
  const cached = forYouCache.get(key)
  if (cached && Date.now() - cached.ts < FORYOU_TTL) return cached.ids
  const since = new Date(Date.now() - 30 * 86400 * 1000)
  const where: any = { parentId: null, deletedAt: null, hiddenAt: null, createdAt: { gte: since } }
  if (excluded.length) where.userId = { notIn: excluded }
  if (!includeNsfw) where.OR = [{ organizationId: null }, { organization: { isNSFW: false } }]
  const candidates = await prisma.organizationPost.findMany({
    where, orderBy: { createdAt: 'desc' }, take: 300,
    select: { id: true, likesCount: true, commentsCount: true, repostCount: true, createdAt: true, userId: true, organizationId: true },
  })
  let followedUsers = new Set<number>(), followedOrgs = new Set<number>()
  if (userId) {
    const [fu, fo] = await Promise.all([
      prisma.userFollow.findMany({ where: { followerId: userId }, select: { followedId: true } }),
      prisma.organizationFollower.findMany({ where: { userId }, select: { organizationId: true } }),
    ])
    followedUsers = new Set(fu.map((x) => x.followedId))
    followedOrgs = new Set(fo.map((x) => x.organizationId))
  }
  const now = Date.now()
  const scored = candidates.map((c) => {
    const ageH = Math.max(0, (now - new Date(c.createdAt).getTime()) / 3600000)
    const engagement = Math.log(1 + c.likesCount + 2 * c.commentsCount + 3 * c.repostCount)
    let score = engagement / Math.pow(ageH + 2, 1.5)
    if (userId && c.userId === userId) score += 0.3
    if (followedUsers.has(c.userId)) score += 2
    if (c.organizationId && followedOrgs.has(c.organizationId)) score += 1.5
    score += 1 / Math.pow(ageH + 2, 1.4)
    return { id: c.id, score }
  })
  scored.sort((a, b) => b.score - a.score)
  const ids = scored.map((x) => x.id)
  forYouCache.set(key, { ids, ts: Date.now() })
  if (forYouCache.size > 500) forYouCache.clear()
  return ids
}

// ================= LECTURA =================
const publicPart = () =>
  new Elysia()
    .use(loggedOptional())
    .get('/api/socials/feed', async ({ query, user }: any) => {
      const limit = Math.min(20, Math.max(1, Number(query.limit) || 10))
      const page = Math.max(0, Number(query.page) || 0)
      const scope = query.scope || 'foryou'
      const includeNsfw = query.nsfw === '1' || query.nsfw === 'true'
      const excluded = await excludedAuthorIds(user?.id)
      if (scope === 'foryou') {
        const ranked = await rankForYou(user?.id, includeNsfw, excluded)
        const pageIds = ranked.slice(page * limit, page * limit + limit)
        const hasMore = ranked.length > (page + 1) * limit
        if (!pageIds.length) return { status: true, data: { items: [], hasMore: false } }
        const rows = await prisma.organizationPost.findMany({ where: { id: { in: pageIds }, deletedAt: null, hiddenAt: null }, select: postSelect })
        rows.sort((a, b) => pageIds.indexOf(a.id) - pageIds.indexOf(b.id))
        const v = await viewerSets(user?.id, rows.map((p) => p.id))
        return { status: true, data: { items: await withReposts(rows, v, user?.id), hasMore } }
      }
      const where: any = { deletedAt: null, hiddenAt: null, parentId: null }
      if (excluded.length) where.userId = { notIn: excluded }
      if (scope === 'following' && user) {
        const [orgs, users] = await Promise.all([
          prisma.organizationFollower.findMany({ where: { userId: user.id }, select: { organizationId: true } }),
          prisma.userFollow.findMany({ where: { followerId: user.id }, select: { followedId: true } }),
        ])
        const orgIds = orgs.map((x) => x.organizationId)
        const userIds = users.map((x) => x.followedId)
        where.OR = [
          ...(orgIds.length ? [{ organizationId: { in: orgIds } }] : []),
          ...(userIds.length ? [{ userId: { in: userIds } }] : []),
          { userId: user.id },
        ]
      }
      if (!includeNsfw) {
        const nsfwClause = [{ organizationId: null }, { organization: { isNSFW: false } }]
        if (where.OR) where.AND = [{ OR: where.OR }, { OR: nsfwClause }], delete where.OR
        else where.OR = nsfwClause
      }
      const orderBy: any = scope === 'popular'
        ? [{ likesCount: 'desc' }, { commentsCount: 'desc' }, { createdAt: 'desc' }]
        : [{ createdAt: 'desc' }]
      const rows = await prisma.organizationPost.findMany({ where, orderBy, skip: page * limit, take: limit + 1, select: postSelect })
      const hasMore = rows.length > limit
      const items = rows.slice(0, limit)
      const v = await viewerSets(user?.id, items.map((p) => p.id))
      return { status: true, data: { items: await withReposts(items, v, user?.id), hasMore } }
    })
    .get('/api/socials/feed/updates', async ({ query, user }: any) => {
      const sinceId = Number(query.sinceId) || 0
      if (!sinceId) return { status: true, data: { count: 0 } }
      const includeNsfw = query.nsfw === '1' || query.nsfw === 'true'
      const where: any = { parentId: null, deletedAt: null, hiddenAt: null, id: { gt: sinceId } }
      const excluded = await excludedAuthorIds(user?.id)
      if (excluded.length) where.userId = { notIn: excluded }
      if (user) where.NOT = { userId: user.id }
      if (!includeNsfw) where.OR = [{ organizationId: null }, { organization: { isNSFW: false } }]
      const count = await prisma.organizationPost.count({ where })
      return { status: true, data: { count } }
    })
    .get('/api/organizations/:slug/posts', async ({ params, query, user }: any) => {
      const org = await prisma.organization.findFirst({ where: { slug: params.slug }, select: { id: true } })
      if (!org) return { status: true, data: { items: [], hasMore: false } }
      const limit = Math.min(20, Math.max(1, Number(query.limit) || 10))
      const page = Math.max(0, Number(query.page) || 0)
      const rows = await prisma.organizationPost.findMany({
        where: { organizationId: org.id, deletedAt: null, hiddenAt: null, parentId: null },
        orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }], skip: page * limit, take: limit + 1, select: postSelect,
      })
      const hasMore = rows.length > limit
      const items = rows.slice(0, limit)
      const v = await viewerSets(user?.id, items.map((p) => p.id))
      return { status: true, data: { items: await withReposts(items, v, user?.id), hasMore } }
    })
    .get('/api/users/:slug/posts', async ({ params, query, user }: any) => {
      const target = await prisma.user.findFirst({ where: { slug: params.slug }, select: { id: true } })
      if (!target) return { status: true, data: { items: [], hasMore: false } }
      const limit = Math.min(20, Math.max(1, Number(query.limit) || 10))
      const page = Math.max(0, Number(query.page) || 0)
      const includeReplies = query.replies === '1'
      const where: any = { userId: target.id, deletedAt: null, hiddenAt: null }
      if (!includeReplies) where.parentId = null
      const rows = await prisma.organizationPost.findMany({ where, orderBy: [{ createdAt: 'desc' }], skip: page * limit, take: limit + 1, select: postSelect })
      const hasMore = rows.length > limit
      const items = rows.slice(0, limit)
      const v = await viewerSets(user?.id, items.map((p) => p.id))
      return { status: true, data: { items: await withReposts(items, v, user?.id), hasMore } }
    })
    .get('/api/posts/:id', async ({ params, user }: any) => {
      const id = Number(params.id)
      if (!Number.isFinite(id)) return { status: false, message: 'Id invalido.' }
      const p = await prisma.organizationPost.findFirst({ where: { id, deletedAt: null, hiddenAt: null }, select: postSelect })
      if (!p) return { status: false, message: 'No encontrada.' }
      const v = await viewerSets(user?.id, [p.id])
      const [full] = await withReposts([p], v, user?.id)
      return { status: true, data: full }
    })
    .get('/api/posts/:id/thread', async ({ params, user }: any) => {
      const id = Number(params.id)
      const post = await prisma.organizationPost.findFirst({ where: { id, deletedAt: null }, select: postSelect })
      if (!post) return { status: false, message: 'No encontrada.' }
      // Cadena de ancestros (hasta 6).
      const ancestors: any[] = []
      let cur: any = post
      for (let i = 0; i < 6 && cur.parentId; i++) {
        const par = await prisma.organizationPost.findFirst({ where: { id: cur.parentId, deletedAt: null }, select: postSelect })
        if (!par) break
        ancestors.unshift(par); cur = par
      }
      const replies = await prisma.organizationPost.findMany({
        where: { parentId: id, deletedAt: null, hiddenAt: null }, orderBy: [{ createdAt: 'asc' }], take: 30, select: postSelect,
      })
      const allIds = [post.id, ...ancestors.map((a) => a.id), ...replies.map((r) => r.id)]
      const v = await viewerSets(user?.id, allIds)
      return {
        status: true,
        data: {
          post: (await withReposts([post], v, user?.id))[0],
          ancestors: await withReposts(ancestors, v, user?.id),
          replies: await withReposts(replies, v, user?.id),
        },
      }
    })
    .get('/api/socials/tag/:tag', async ({ params, query, user }: any) => {
      const tag = String(params.tag || '').toLowerCase().slice(0, 80)
      const limit = Math.min(20, Math.max(1, Number(query.limit) || 10))
      const page = Math.max(0, Number(query.page) || 0)
      const tagged = await prisma.organizationPostHashtag.findMany({
        where: { tag }, orderBy: { createdAt: 'desc' }, skip: page * limit, take: limit + 1, select: { postId: true },
      })
      const hasMore = tagged.length > limit
      const ids = tagged.slice(0, limit).map((t) => t.postId)
      const rows = await prisma.organizationPost.findMany({ where: { id: { in: ids }, deletedAt: null, hiddenAt: null }, select: postSelect })
      rows.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
      const v = await viewerSets(user?.id, rows.map((p) => p.id))
      return { status: true, data: { items: await withReposts(rows, v, user?.id), hasMore, tag } }
    })
    .get('/api/socials/search', async ({ query, user }: any) => {
      const q = String(query.q || '').trim().slice(0, 100)
      if (q.length < 2) return { status: true, data: { items: [], users: [], hasMore: false } }
      const limit = Math.min(20, Math.max(1, Number(query.limit) || 10))
      const page = Math.max(0, Number(query.page) || 0)
      const rows = await prisma.organizationPost.findMany({
        where: { deletedAt: null, hiddenAt: null, content: { contains: q, mode: 'insensitive' } },
        orderBy: [{ createdAt: 'desc' }], skip: page * limit, take: limit + 1, select: postSelect,
      })
      const hasMore = rows.length > limit
      const items = rows.slice(0, limit)
      const v = await viewerSets(user?.id, items.map((p) => p.id))
      let users: any[] = []
      if (page === 0) {
        const us = await prisma.user.findMany({ where: { username: { contains: q, mode: 'insensitive' } }, select: { username: true, slug: true, imageUrl: true }, take: 5 })
        users = us
      }
      return { status: true, data: { items: await withReposts(items, v, user?.id), users, hasMore } }
    })
    .get('/api/socials/trending', async () => {
      const since = new Date(Date.now() - 7 * 86400 * 1000)
      const rows = await prisma.organizationPostHashtag.groupBy({
        by: ['tag'], where: { createdAt: { gte: since } }, _count: { tag: true },
        orderBy: { _count: { tag: 'desc' } }, take: 10,
      })
      return { status: true, data: rows.map((r) => ({ tag: r.tag, count: r._count.tag })) }
    })

// ================= INTERACCIONES (logueado) =================
const interactions = () =>
  new Elysia()
    .use(logged())
    .get('/api/socials/saved', async ({ query, user }: any) => {
      const limit = Math.min(20, Math.max(1, Number(query.limit) || 10))
      const page = Math.max(0, Number(query.page) || 0)
      const saved = await prisma.organizationPostSave.findMany({
        where: { userId: user.id }, orderBy: { createdAt: 'desc' }, skip: page * limit, take: limit + 1, select: { postId: true },
      })
      const hasMore = saved.length > limit
      const ids = saved.slice(0, limit).map((s) => s.postId)
      const rows = await prisma.organizationPost.findMany({ where: { id: { in: ids }, deletedAt: null }, select: postSelect })
      rows.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
      const v = await viewerSets(user.id, rows.map((p) => p.id))
      return { status: true, data: { items: await withReposts(rows, v, user.id), hasMore } }
    })
    .post('/api/socials/posts', async ({ body, user }: any) => {
      const isReply = !!body.parentId
      assertRateLimit(`post:${user.id}`, isReply ? 20 : 5, 5 * 60 * 1000, 'Vas muy rápido, espera un momento.')
      assertRateLimit(`post-day:${user.id}`, 120, 24 * 3600 * 1000, 'Alcanzaste el límite diario de publicaciones.')
      const content = (body.content || '').slice(0, MAX_CONTENT)
      const images = toImages(body.images)
      const parentId = body.parentId ? Number(body.parentId) : null
      const repostOfId = body.repostOf ? Number(body.repostOf) : null
      if (content.trim().length < 1 && images.length === 0 && !repostOfId) throw new Error('La publicacion esta vacia.')

      let organizationId: number | null = null
      if (body.orgSlug) {
        const org = await prisma.organization.findFirst({ where: { slug: body.orgSlug }, select: { id: true } })
        if (!org || !isStaff(user, org.id)) throw new Error('No autorizado para publicar como ese scan.')
        organizationId = org.id
      }
      let parent: any = null
      if (parentId) {
        parent = await prisma.organizationPost.findFirst({ where: { id: parentId, deletedAt: null }, select: { id: true, userId: true, organizationId: true } })
        if (!parent) throw new Error('La publicacion a la que respondes no existe.')
      }
      let repostTarget: any = null
      if (repostOfId) {
        repostTarget = await prisma.organizationPost.findFirst({ where: { id: repostOfId, deletedAt: null }, select: { id: true, userId: true } })
        if (!repostTarget) throw new Error('La publicacion que citas no existe.')
      }

      if (content.trim().length > 0) {
        const last = await prisma.organizationPost.findFirst({ where: { userId: user.id, deletedAt: null }, orderBy: { id: 'desc' }, select: { content: true } })
        if (last && last.content.trim() === content.trim()) throw new Error('Ya publicaste eso mismo hace un momento.')
      }
      const post = await prisma.organizationPost.create({
        data: {
          organizationId, userId: user.id, content, images, parentId, repostOfId,
          isSpoiler: !!body.isSpoiler, isSensitive: !!body.isSensitive,
          spoilerOfMangaCustomId: body.spoilerOfMangaCustomId ? Number(body.spoilerOfMangaCustomId) : null,
          spoilerChapter: body.spoilerChapter != null ? Number(body.spoilerChapter) : null,
          workMangaCustomId: body.workMangaCustomId ? Number(body.workMangaCustomId) : null,
        },
        select: postSelect,
      })
      await prisma.user.update({ where: { id: user.id }, data: { postsCount: { increment: 1 } } }).catch(() => {})

      const tags = parseHashtags(content)
      if (tags.length) await prisma.organizationPostHashtag.createMany({ data: tags.map((tag) => ({ postId: post.id, tag })) }).catch(() => {})
      let createdPoll: any = null
      if (body.poll && Array.isArray(body.poll.options)) {
        const opts = body.poll.options.map((o: any) => String(o || '').trim()).filter(Boolean).slice(0, 4)
        if (opts.length >= 2) {
          const hours = Math.min(168, Math.max(1, Number(body.poll.durationHours) || 24))
          const endsAt = new Date(Date.now() + hours * 3600 * 1000)
          createdPoll = await prisma.postPoll.create({ data: { postId: post.id, options: opts.map((text: string) => ({ text, votes: 0 })), endsAt }, select: { id: true, options: true, votesCount: true, endsAt: true } })
        }
      }
      if (parent) {
        await prisma.organizationPost.update({ where: { id: parent.id }, data: { commentsCount: { increment: 1 } } })
        await notify(parent.userId, 'post_reply', post.id, user.id, parent.organizationId)
      }
      if (repostTarget) {
        await prisma.organizationPost.update({ where: { id: repostTarget.id }, data: { repostCount: { increment: 1 } } })
        await notify(repostTarget.userId, 'post_repost', repostTarget.id, user.id)
      }
      await notifyMentions(content, post.id, user.id)

      const v = await viewerSets(user.id, [post.id])
      const [full] = await withReposts([post], v, user.id)
      if (createdPoll) full.poll = { id: createdPoll.id, options: createdPoll.options, votesCount: 0, endsAt: createdPoll.endsAt, myVote: null }
      return { status: true, data: full }
    }, { body: t.Object({ content: t.Optional(t.String()), images: t.Optional(t.Array(t.String())), orgSlug: t.Optional(t.Union([t.String(), t.Null()])), parentId: t.Optional(t.Union([t.Number(), t.Null()])), repostOf: t.Optional(t.Union([t.Number(), t.Null()])), isSpoiler: t.Optional(t.Boolean()), isSensitive: t.Optional(t.Boolean()), spoilerOfMangaCustomId: t.Optional(t.Union([t.Number(), t.Null()])), spoilerChapter: t.Optional(t.Union([t.Number(), t.Null()])), workMangaCustomId: t.Optional(t.Union([t.Number(), t.Null()])), poll: t.Optional(t.Any()) }) })
    .post('/api/posts/:id/like', async ({ params, user }: any) => {
      assertRateLimit(`like:${user.id}`, 300, 3600 * 1000, 'Demasiadas acciones, espera un momento.')
      const id = Number(params.id)
      const post = await prisma.organizationPost.findFirst({ where: { id, deletedAt: null }, select: { id: true, userId: true } })
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
      await notify(post.userId, 'post_like', id, user.id)
      const p = await prisma.organizationPost.findUnique({ where: { id }, select: { likesCount: true } })
      return { status: true, data: { liked: true, likesCount: p?.likesCount ?? 1 } }
    })
    .post('/api/posts/:id/save', async ({ params, user }: any) => {
      const id = Number(params.id)
      const post = await prisma.organizationPost.findFirst({ where: { id, deletedAt: null }, select: { id: true } })
      if (!post) throw new Error('No encontrada.')
      const existing = await prisma.organizationPostSave.findUnique({ where: { postId_userId: { postId: id, userId: user.id } } })
      if (existing) { await prisma.organizationPostSave.delete({ where: { id: existing.id } }); return { status: true, data: { saved: false } } }
      await prisma.organizationPostSave.create({ data: { postId: id, userId: user.id } })
      return { status: true, data: { saved: true } }
    })
    .post('/api/polls/:id/vote', async ({ params, body, user }: any) => {
      const pollId = Number(params.id)
      const poll = await prisma.postPoll.findUnique({ where: { id: pollId }, select: { id: true, options: true, votesCount: true, endsAt: true } })
      if (!poll) throw new Error('Encuesta no encontrada.')
      if (new Date(poll.endsAt).getTime() < Date.now()) throw new Error('La encuesta ya terminó.')
      const opts = (Array.isArray(poll.options) ? poll.options : []) as any[]
      const oi = Number(body.optionIndex)
      if (!Number.isInteger(oi) || oi < 0 || oi >= opts.length) throw new Error('Opción inválida.')
      try { await prisma.postPollVote.create({ data: { pollId, userId: user.id, optionIndex: oi } }) }
      catch { throw new Error('Ya votaste en esta encuesta.') }
      opts[oi].votes = (opts[oi].votes || 0) + 1
      const updated = await prisma.postPoll.update({ where: { id: pollId }, data: { options: opts, votesCount: { increment: 1 } }, select: { options: true, votesCount: true, endsAt: true } })
      return { status: true, data: { options: updated.options, votesCount: updated.votesCount, endsAt: updated.endsAt, myVote: oi } }
    }, { body: t.Object({ optionIndex: t.Number() }) })
    .post('/api/posts/:id/repost', async ({ params, user }: any) => {
      const id = Number(params.id)
      const post = await prisma.organizationPost.findFirst({ where: { id, deletedAt: null }, select: { id: true, userId: true } })
      if (!post) throw new Error('No encontrada.')
      const existing = await prisma.organizationPost.findFirst({ where: { userId: user.id, repostOfId: id, content: '', deletedAt: null }, select: { id: true } })
      if (existing) {
        await prisma.$transaction([
          prisma.organizationPost.update({ where: { id: existing.id }, data: { deletedAt: new Date() } }),
          prisma.organizationPost.update({ where: { id }, data: { repostCount: { decrement: 1 } } }),
        ])
        const p = await prisma.organizationPost.findUnique({ where: { id }, select: { repostCount: true } })
        return { status: true, data: { reposted: false, repostCount: Math.max(0, p?.repostCount ?? 0) } }
      }
      await prisma.$transaction([
        prisma.organizationPost.create({ data: { userId: user.id, content: '', repostOfId: id } }),
        prisma.organizationPost.update({ where: { id }, data: { repostCount: { increment: 1 } } }),
      ])
      await notify(post.userId, 'post_repost', id, user.id)
      const p = await prisma.organizationPost.findUnique({ where: { id }, select: { repostCount: true } })
      return { status: true, data: { reposted: true, repostCount: p?.repostCount ?? 1 } }
    })
    .patch('/api/organization-post/:id', async ({ params, body, user }: any) => {
      const id = Number(params.id)
      const post = await prisma.organizationPost.findFirst({ where: { id, deletedAt: null }, select: { id: true, userId: true, organizationId: true } })
      if (!post) throw new Error('No encontrada.')
      const canEdit = post.userId === user.id || isStaff(user, post.organizationId)
      if (!canEdit) throw new Error('No autorizado.')
      const data: any = {}
      if (body.content !== undefined) data.content = (body.content || '').slice(0, MAX_CONTENT)
      if (body.pinned !== undefined && isStaff(user, post.organizationId)) data.pinned = !!body.pinned
      const updated = await prisma.organizationPost.update({ where: { id }, data, select: postSelect })
      const v = await viewerSets(user.id, [id])
      return { status: true, data: shape(updated, v) }
    }, { body: t.Object({ content: t.Optional(t.String()), pinned: t.Optional(t.Boolean()) }) })
    .delete('/api/organization-post/:id', async ({ params, user }: any) => {
      const id = Number(params.id)
      const post = await prisma.organizationPost.findFirst({ where: { id, deletedAt: null }, select: { id: true, userId: true, organizationId: true, parentId: true, repostOfId: true } })
      if (!post) throw new Error('No encontrada.')
      const canDelete = post.userId === user.id || isStaff(user, post.organizationId)
      if (!canDelete) throw new Error('No autorizado.')
      await prisma.organizationPost.update({ where: { id }, data: { deletedAt: new Date() } })
      await prisma.user.update({ where: { id: post.userId }, data: { postsCount: { decrement: 1 } } }).catch(() => {})
      if (post.parentId) await prisma.organizationPost.update({ where: { id: post.parentId }, data: { commentsCount: { decrement: 1 } } }).catch(() => {})
      if (post.repostOfId) await prisma.organizationPost.update({ where: { id: post.repostOfId }, data: { repostCount: { decrement: 1 } } }).catch(() => {})
      return { status: true }
    })

export const router = () => new Elysia().use(publicPart()).use(interactions())
