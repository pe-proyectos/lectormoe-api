import { prisma } from '../models/prisma';

// Fan-out for a freshly created chapter. Inserts one Notification row per
// distinct user that has the manga (or joint) in their favorites or user-list.
// "favorite" wins over "user_list" when the user has both. Fire-and-forget —
// callers should not await this in the request path.
//
// Joint-aware: when a chapter is created against a mangaCustomId AND the manga
// has an active joint that the org is an ACCEPTED member of, the fan-out also
// includes users following the joint. Dedupe is by userId across all sources.
export const notifyNewChapter = async (params: {
  chapterId: number;
  mangaCustomId?: number | null;
  jointId?: number | null;
}) => {
  const { chapterId, mangaCustomId, jointId } = params;
  if (!mangaCustomId && !jointId) return;

  // Resolve a sibling joint when the chapter was published from a member's
  // MangaCustom. The chapter rides the joint's notification fan-out too.
  let extraJointId: number | null = null;
  if (mangaCustomId && !jointId) {
    const mc = await prisma.mangaCustom.findUnique({
      where: { id: mangaCustomId },
      select: { mangaId: true, organizationId: true },
    });
    if (mc) {
      const sibling = await prisma.mangaJoint.findFirst({
        where: {
          deletedAt: null,
          mangaId: mc.mangaId,
          members: { some: { organizationId: mc.organizationId, status: 'ACCEPTED' } },
        },
        select: { id: true },
      });
      if (sibling) extraJointId = sibling.id;
    }
  }

  const sourceByUser = new Map<number, 'favorite' | 'user_list'>();

  const collect = async (kind: 'mc' | 'joint', targetId: number) => {
    const ulRows = await prisma.userList.findMany({
      where: kind === 'mc' ? { mangaCustomId: targetId } : { jointId: targetId },
      select: { userId: true },
    });
    for (const r of ulRows) {
      if (!sourceByUser.has(r.userId)) sourceByUser.set(r.userId, 'user_list');
    }
    const favRows = await prisma.favorite.findMany({
      where: kind === 'mc' ? { mangaCustomId: targetId } : { jointId: targetId },
      select: { userId: true },
    });
    for (const r of favRows) sourceByUser.set(r.userId, 'favorite');
  };

  if (mangaCustomId) await collect('mc', mangaCustomId);
  if (jointId) await collect('joint', jointId);
  if (extraJointId) await collect('joint', extraJointId);

  if (sourceByUser.size === 0) return;

  // Each user gets ONE notification. Prefer attaching the joint context when
  // available (so the FE can route to /joint/manga/...).
  const effectiveJointId = jointId ?? extraJointId ?? null;

  await prisma.notification.createMany({
    data: [...sourceByUser.entries()].map(([userId, source]) => ({
      userId,
      type: 'new_chapter',
      mangaCustomId: effectiveJointId ? null : (mangaCustomId ?? null),
      jointId: effectiveJointId,
      chapterId,
      source,
    })),
    skipDuplicates: true,
  });
};

// Fan-out: parent-comment author gets notified when someone replies. Skip
// self-replies. The reply.organizationId is captured so the dispatcher can
// rebuild the thread URL.
export const notifyCommentReply = async (replyCommentId: number) => {
  const reply = await prisma.comment.findUnique({
    where: { id: replyCommentId },
    select: {
      id: true,
      userId: true,
      parentId: true,
      organizationId: true,
      parent: { select: { id: true, userId: true } },
    },
  });
  if (!reply || !reply.parentId || !reply.parent) return;
  if (reply.userId === reply.parent.userId) return;

  await prisma.notification.create({
    data: {
      userId: reply.parent.userId,
      type: 'comment_reply',
      commentId: reply.id,
      parentCommentId: reply.parent.id,
      organizationId: reply.organizationId,
      source: 'reply',
    },
  });
};

// Fan-out: organization followers get notified for a new manga release.
export const notifyNewManga = async (mangaCustomId: number, organizationId: number) => {
  const followers = await prisma.organizationFollower.findMany({
    where: { organizationId },
    select: { userId: true },
  });
  if (followers.length === 0) return;

  await prisma.notification.createMany({
    data: followers.map((f) => ({
      userId: f.userId,
      type: 'new_manga',
      mangaCustomId,
      organizationId,
      source: 'org_follower',
    })),
    skipDuplicates: true,
  });
};

// Fan-out: org staff (Permission.canSeeAdminPanel = true) get notified about
// a new active subscriber.
export const notifyNewSubscriber = async (subscriptionId: number) => {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: { id: true, organizationId: true },
  });
  if (!subscription || !subscription.organizationId) return;

  const staff = await prisma.permission.findMany({
    where: {
      organizationId: subscription.organizationId,
      canSeeAdminPanel: true,
    },
    select: { userId: true },
  });
  if (staff.length === 0) return;

  await prisma.notification.createMany({
    data: staff.map((p) => ({
      userId: p.userId,
      type: 'new_subscriber',
      subscriptionId: subscription.id,
      organizationId: subscription.organizationId,
      source: 'org_staff',
    })),
    skipDuplicates: true,
  });
};

// Fan-out: org staff get notified about a failed payment on a subscription.
export const notifyFailedPayment = async (subscriptionId: number) => {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: { id: true, organizationId: true },
  });
  if (!subscription || !subscription.organizationId) return;

  const staff = await prisma.permission.findMany({
    where: {
      organizationId: subscription.organizationId,
      canSeeAdminPanel: true,
    },
    select: { userId: true },
  });
  if (staff.length === 0) return;

  await prisma.notification.createMany({
    data: staff.map((p) => ({
      userId: p.userId,
      type: 'failed_payment',
      subscriptionId: subscription.id,
      organizationId: subscription.organizationId,
      source: 'org_staff',
    })),
    skipDuplicates: true,
  });
};
