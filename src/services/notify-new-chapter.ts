import { prisma } from '../models/prisma'

// Fan-out for a freshly created chapter. Inserts one Notification row per
// distinct user that has the manga (or joint) in their favorites or user-list.
// "favorite" wins over "user_list" when the user has both. Fire-and-forget —
// callers should not await this in the request path.
//
// Joint-aware: when a chapter is created against a mangaCustomId AND the manga
// has an active joint that the org is an ACCEPTED member of, the fan-out also
// includes users following the joint. Dedupe is by userId across all sources.
export const notifyNewChapter = async (params: {
  chapterId: number
  mangaCustomId?: number | null
  jointId?: number | null
}) => {
  const { chapterId, mangaCustomId, jointId } = params
  if (!mangaCustomId && !jointId) return

  // Resolve a sibling joint when the chapter was published from a member's
  // MangaCustom. The chapter rides the joint's notification fan-out too.
  let extraJointId: number | null = null
  if (mangaCustomId && !jointId) {
    const mc = await prisma.mangaCustom.findUnique({
      where: { id: mangaCustomId },
      select: { mangaId: true, organizationId: true }
    })
    if (mc) {
      const sibling = await prisma.mangaJoint.findFirst({
        where: {
          deletedAt: null,
          mangaId: mc.mangaId,
          members: {
            some: { organizationId: mc.organizationId, status: 'ACCEPTED' }
          }
        },
        select: { id: true }
      })
      if (sibling) extraJointId = sibling.id
    }
  }

  const sourceByUser = new Map<number, 'favorite' | 'user_list'>()

  const collect = async (kind: 'mc' | 'joint', targetId: number) => {
    const ulRows = await prisma.userList.findMany({
      where:
        kind === 'mc' ? { mangaCustomId: targetId } : { jointId: targetId },
      select: { userId: true }
    })
    for (const r of ulRows) {
      if (!sourceByUser.has(r.userId)) sourceByUser.set(r.userId, 'user_list')
    }
    const favRows = await prisma.favorite.findMany({
      where:
        kind === 'mc' ? { mangaCustomId: targetId } : { jointId: targetId },
      select: { userId: true }
    })
    for (const r of favRows) sourceByUser.set(r.userId, 'favorite')
  }

  if (mangaCustomId) await collect('mc', mangaCustomId)
  if (jointId) await collect('joint', jointId)
  if (extraJointId) await collect('joint', extraJointId)

  if (sourceByUser.size === 0) return

  // Each user gets ONE notification. Prefer attaching the joint context when
  // available (so the FE can route to /joint/manga/...).
  const effectiveJointId = jointId ?? extraJointId ?? null

  await prisma.notification.createMany({
    data: [...sourceByUser.entries()].map(([userId, source]) => ({
      userId,
      type: 'new_chapter',
      mangaCustomId: effectiveJointId ? null : (mangaCustomId ?? null),
      jointId: effectiveJointId,
      chapterId,
      source
    })),
    skipDuplicates: true
  })

  // Avisos de capítulo objetivo (Tarea 18): al publicarse el capítulo N de una
  // obra, dispara los alerts con targetNumber <= N que no se hayan disparado.
  await triggerMilestoneAlerts(
    chapterId,
    mangaCustomId ?? null,
    jointId ?? null
  )
}

async function triggerMilestoneAlerts(
  chapterId: number,
  mangaCustomId: number | null,
  jointId: number | null
) {
  try {
    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      select: {
        number: true,
        mangaCustom: { select: { mangaId: true } },
        joint: { select: { mangaId: true } }
      }
    })
    if (!chapter) return
    const baseMangaId = chapter.mangaCustom?.mangaId ?? chapter.joint?.mangaId
    if (!baseMangaId) return
    const N = chapter.number

    // Alerts pendientes de cualquier MangaCustom/joint de esta obra base.
    const alerts = await prisma.chapterMilestoneAlert.findMany({
      where: {
        triggeredAt: null,
        targetNumber: { lte: N },
        OR: [
          { mangaCustom: { mangaId: baseMangaId } },
          { joint: { mangaId: baseMangaId } }
        ]
      },
      select: { id: true, userId: true, mangaCustomId: true, jointId: true }
    })
    if (alerts.length === 0) return

    await prisma.notification.createMany({
      data: alerts.map((a) => ({
        userId: a.userId,
        type: 'chapter_milestone',
        mangaCustomId: a.mangaCustomId,
        jointId: a.jointId,
        chapterId,
        source: 'favorite' as const
      })),
      skipDuplicates: true
    })
    await prisma.chapterMilestoneAlert.updateMany({
      where: { id: { in: alerts.map((a) => a.id) } },
      data: { triggeredAt: new Date() }
    })
  } catch (e) {
    console.error('[milestone] trigger failed', e)
  }
}

// Single entry point fired for every new comment. Produces:
//   - reply notification for the parent author (delayed-email via cron) if any
//   - "comment on owned content" notifications (in-app only) for owners of the
//     manga / chapter / joint the comment is on
// In-app-only is achieved by stamping emailSentAt at creation so the cron's
// `where { emailSentAt: null }` filter excludes them.
export const notifyComment = async (commentId: number) => {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      userId: true,
      parentId: true,
      identifier: true,
      organizationId: true,
      parent: {
        select: {
          id: true,
          userId: true,
          user: { select: { emailNotifications: true } }
        }
      }
    }
  })
  if (!comment) return

  // Identifier formats:
  //   {mangaSlug}                          → top-level on a scan manga
  //   {mangaSlug}_{chapterNumber}          → chapter on a scan manga
  //   joint_{jointSlug}                    → top-level on a joint
  //   joint_{jointSlug}_{chapterNumber}    → chapter on a joint
  const identifier = comment.identifier
  const isJoint = identifier.startsWith('joint_')

  // Resolve owner userIds for the content the comment is on.
  let ownerUserIds: number[] = []
  if (isJoint) {
    // Strip the leading "joint_" then strip a trailing "_<number>" if present
    // (decimal chapters like 10.5 included).
    let jointSlug = identifier.slice('joint_'.length)
    const lastUnderscore = jointSlug.lastIndexOf('_')
    if (
      lastUnderscore > 0 &&
      /^\d+(\.\d+)?$/.test(jointSlug.slice(lastUnderscore + 1))
    ) {
      jointSlug = jointSlug.slice(0, lastUnderscore)
    }
    const joint = await prisma.mangaJoint.findFirst({
      where: { slug: jointSlug, deletedAt: null },
      select: {
        members: {
          where: { status: 'ACCEPTED' },
          select: {
            organization: {
              select: {
                permissions: {
                  where: { canSeeAdminPanel: true },
                  select: { userId: true }
                }
              }
            }
          }
        }
      }
    })
    if (joint) {
      const set = new Set<number>()
      for (const m of joint.members) {
        for (const p of m.organization.permissions) set.add(p.userId)
      }
      ownerUserIds = [...set]
    }
  } else if (comment.organizationId) {
    const staff = await prisma.permission.findMany({
      where: { organizationId: comment.organizationId, canSeeAdminPanel: true },
      select: { userId: true }
    })
    ownerUserIds = staff.map((s) => s.userId)
  }

  // Per-user opt-out filter.
  if (ownerUserIds.length > 0) {
    const prefs = await prisma.user.findMany({
      where: { id: { in: ownerUserIds } },
      select: { id: true, notifyCommentsOnOwnedContent: true }
    })
    const allowed = new Set(
      prefs.filter((u) => u.notifyCommentsOnOwnedContent).map((u) => u.id)
    )
    ownerUserIds = ownerUserIds.filter((id) => allowed.has(id))
  }

  const planned: Array<{
    userId: number
    type: 'comment_reply' | 'comment_on_owned_content'
    commentId: number
    parentCommentId: number | null
    organizationId: number | null
    source: 'reply' | 'owned_content'
    emailSentAt?: Date | null
  }> = []

  // Reply notification — preserves existing behavior.
  if (
    comment.parentId &&
    comment.parent &&
    comment.userId !== comment.parent.userId &&
    comment.parent.user?.emailNotifications !== false
  ) {
    planned.push({
      userId: comment.parent.userId,
      type: 'comment_reply',
      commentId: comment.id,
      parentCommentId: comment.parent.id,
      organizationId: comment.organizationId,
      source: 'reply'
    })
  }

  // Owned-content notifications — in-app only.
  const replyTargetUserId = comment.parent?.userId ?? null
  for (const userId of ownerUserIds) {
    if (userId === comment.userId) continue
    if (replyTargetUserId !== null && userId === replyTargetUserId) continue
    planned.push({
      userId,
      type: 'comment_on_owned_content',
      commentId: comment.id,
      parentCommentId: comment.parentId ?? null,
      organizationId: comment.organizationId,
      source: 'owned_content',
      emailSentAt: new Date()
    })
  }

  if (planned.length === 0) return

  await prisma.notification.createMany({
    data: planned,
    skipDuplicates: true
  })
}

// Backwards-compat alias for callers still importing the old name.
export const notifyCommentReply = notifyComment

// Fan-out: organization followers get notified for a new manga release.
export const notifyNewManga = async (
  mangaCustomId: number,
  organizationId: number
) => {
  const followers = await prisma.organizationFollower.findMany({
    where: { organizationId },
    select: { userId: true }
  })
  if (followers.length === 0) return

  await prisma.notification.createMany({
    data: followers.map((f) => ({
      userId: f.userId,
      type: 'new_manga',
      mangaCustomId,
      organizationId,
      source: 'org_follower'
    })),
    skipDuplicates: true
  })
}

// Fan-out: org staff (Permission.canSeeAdminPanel = true) get notified about
// a new active subscriber.
export const notifyNewSubscriber = async (subscriptionId: number) => {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: { id: true, organizationId: true }
  })
  if (!subscription || !subscription.organizationId) return

  const staff = await prisma.permission.findMany({
    where: {
      organizationId: subscription.organizationId,
      canSeeAdminPanel: true
    },
    select: { userId: true }
  })
  if (staff.length === 0) return

  await prisma.notification.createMany({
    data: staff.map((p) => ({
      userId: p.userId,
      type: 'new_subscriber',
      subscriptionId: subscription.id,
      organizationId: subscription.organizationId,
      source: 'org_staff'
    })),
    skipDuplicates: true
  })
}

// Fan-out: org staff get notified about a failed payment on a subscription.
export const notifyFailedPayment = async (subscriptionId: number) => {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: { id: true, organizationId: true }
  })
  if (!subscription || !subscription.organizationId) return

  const staff = await prisma.permission.findMany({
    where: {
      organizationId: subscription.organizationId,
      canSeeAdminPanel: true
    },
    select: { userId: true }
  })
  if (staff.length === 0) return

  await prisma.notification.createMany({
    data: staff.map((p) => ({
      userId: p.userId,
      type: 'failed_payment',
      subscriptionId: subscription.id,
      organizationId: subscription.organizationId,
      source: 'org_staff'
    })),
    skipDuplicates: true
  })
}
