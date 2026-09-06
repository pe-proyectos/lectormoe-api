import { prisma } from '../models/prisma'

const GROUPABLE = new Set(['post_like', 'user_follow'])
function keyFor(type: string, postId: number | null): string | null {
  if (type === 'post_like') return `post_like:${postId}`
  if (type === 'user_follow') return 'user_follow'
  return null
}

// Notificacion social con agrupacion ("A y 3 mas le dieron like").
export async function notifySocial(opts: { userId: number | null | undefined; type: string; actorUserId: number; postId?: number | null; organizationId?: number | null }) {
  const { userId, type, actorUserId } = opts
  const postId = opts.postId ?? null
  const organizationId = opts.organizationId ?? null
  if (!userId || userId === actorUserId) return
  const groupKey = keyFor(type, postId)
  try {
    if (groupKey) {
      const existing = await prisma.notification.findFirst({ where: { userId, groupKey, readAt: null }, select: { id: true, actorUserId: true, extraActorIds: true } })
      if (existing) {
        const extraRaw = Array.isArray(existing.extraActorIds) ? (existing.extraActorIds as number[]) : []
        const newExtra = existing.actorUserId && existing.actorUserId !== actorUserId
          ? [existing.actorUserId, ...extraRaw.filter((x) => x !== existing.actorUserId && x !== actorUserId)].slice(0, 3)
          : extraRaw
        await prisma.notification.update({ where: { id: existing.id }, data: { actorUserId, actorsCount: { increment: 1 }, extraActorIds: newExtra, createdAt: new Date(), postId } })
        return
      }
    }
    await prisma.notification.create({ data: { userId, type, actorUserId, postId, organizationId, source: 'reply', groupKey } })
  } catch { /* fire-and-forget */ }
}
