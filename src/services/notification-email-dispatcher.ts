import { prisma } from "../models/prisma";
import { sendEmail, BASE_URL } from "./email";
import { canSendEmail, getUnsubscribeUrl } from "./email-preferences";
import * as templates from "./email-templates";

// The Notification row IS the dedup record, so all dispatcher sendEmail calls
// pass dedupWindowMinutes: 0 — the cron stamps emailSentAt and won't re-pick.

const mapTypeToEmailType = (t: string): string | null => {
  switch (t) {
    case 'new_chapter':
      return 'new_chapter_alert';
    case 'comment_reply':
      return 'comment_reply';
    case 'new_manga':
      return 'new_manga_release';
    case 'new_subscriber':
      return 'new_subscriber_alert';
    case 'failed_payment':
      return 'failed_payment_alert';
    default:
      return null;
  }
};

type Dispatchable = Awaited<ReturnType<typeof loadNotification>>;

const loadNotification = async (id: number) => {
  return prisma.notification.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, email: true, username: true, emailNotifications: true },
      },
      mangaCustom: {
        include: {
          manga: { select: { slug: true } },
          organization: { select: { name: true, slug: true } },
        },
      },
      joint: {
        select: { id: true, slug: true, title: true, imageUrl: true },
      },
      chapter: {
        select: { id: true, number: true, title: true },
      },
      comment: {
        include: {
          user: { select: { id: true, username: true } },
          organization: { select: { slug: true } },
        },
      },
      parentComment: true,
      subscription: {
        include: {
          subscriptionPlan: { select: { name: true } },
          user: { select: { id: true, email: true, username: true } },
        },
      },
      organization: { select: { id: true, name: true, slug: true } },
    },
  });
};

const sendChapterEmail = async (n: NonNullable<Dispatchable>): Promise<boolean> => {
  if (!n.chapter) return false;

  // Joint chapter — mirror sendNewJointChapterAlert.
  if (n.joint) {
    const readUrl = `${BASE_URL}/joint/manga/${n.joint.slug}/chapters/${n.chapter.number}`;
    // We don't fetch joint members here; the joint-attached "(N scans)" was a
    // batch-only nicety. A simple "Joint" badge is enough for per-user delivery.
    const orgNames = 'Joint';
    const unsubscribeUrl = await getUnsubscribeUrl(n.user!.id, 'new_chapter_alert');
    const html = templates.newChapterAlertTemplate(
      n.user!.username,
      n.joint.title,
      n.chapter.number,
      n.chapter.title,
      n.joint.imageUrl,
      readUrl,
      orgNames,
      unsubscribeUrl,
    );
    const id = await sendEmail({
      userId: n.user!.id,
      to: n.user!.email,
      subject: `Nuevo Cap. ${n.chapter.number} de ${n.joint.title} - Joint`,
      html,
      emailType: 'new_chapter_alert',
      metadata: { jointId: n.jointId, chapterId: n.chapterId, notificationId: n.id },
      dedupWindowMinutes: 0,
    });
    return !!id;
  }

  if (!n.mangaCustom || !n.mangaCustom.manga || !n.mangaCustom.organization) return false;
  const readUrl = `${BASE_URL}/${n.mangaCustom.organization.slug}/manga/${n.mangaCustom.manga.slug}/chapters/${n.chapter.number}`;
  const unsubscribeUrl = await getUnsubscribeUrl(n.user!.id, 'new_chapter_alert');
  const html = templates.newChapterAlertTemplate(
    n.user!.username,
    n.mangaCustom.title,
    n.chapter.number,
    n.chapter.title,
    n.mangaCustom.imageUrl,
    readUrl,
    n.mangaCustom.organization.name,
    unsubscribeUrl,
  );
  const id = await sendEmail({
    userId: n.user!.id,
    to: n.user!.email,
    subject: `Nuevo Cap. ${n.chapter.number} de ${n.mangaCustom.title} - ${n.mangaCustom.organization.name}`,
    html,
    emailType: 'new_chapter_alert',
    metadata: {
      mangaCustomId: n.mangaCustomId,
      chapterId: n.chapterId,
      notificationId: n.id,
    },
    dedupWindowMinutes: 0,
  });
  return !!id;
};

const sendCommentReplyEmail = async (n: NonNullable<Dispatchable>): Promise<boolean> => {
  if (!n.comment || !n.parentComment || !n.comment.user || !n.comment.organization) return false;

  // Match sendCommentReplyNotification's identifier-parsing rules.
  const identifier = n.comment.identifier;
  const lastUnderscore = identifier.lastIndexOf('_');
  let threadUrl: string;
  if (lastUnderscore > 0 && /^\d+$/.test(identifier.slice(lastUnderscore + 1))) {
    const mangaSlug = identifier.slice(0, lastUnderscore);
    const chapterNumber = identifier.slice(lastUnderscore + 1);
    threadUrl = `${BASE_URL}/${n.comment.organization.slug}/manga/${mangaSlug}/chapters/${chapterNumber}`;
  } else {
    threadUrl = `${BASE_URL}/${n.comment.organization.slug}/manga/${identifier}`;
  }

  const unsubscribeUrl = await getUnsubscribeUrl(n.user!.id, 'comment_reply');
  const html = templates.commentReplyTemplate(
    n.user!.username,
    n.comment.user.username,
    n.parentComment.comment,
    n.comment.comment,
    threadUrl,
    unsubscribeUrl,
  );
  const id = await sendEmail({
    userId: n.user!.id,
    to: n.user!.email,
    subject: `${n.comment.user.username} respondio a tu comentario - Capibara Traductor`,
    html,
    emailType: 'comment_reply',
    metadata: { commentId: n.commentId, parentCommentId: n.parentCommentId, notificationId: n.id },
    dedupWindowMinutes: 0,
  });
  return !!id;
};

const sendNewMangaEmail = async (n: NonNullable<Dispatchable>): Promise<boolean> => {
  if (!n.mangaCustom || !n.mangaCustom.manga || !n.mangaCustom.organization) return false;

  const readUrl = `${BASE_URL}/${n.mangaCustom.organization.slug}/manga/${n.mangaCustom.manga.slug}`;
  const unsubscribeUrl = await getUnsubscribeUrl(n.user!.id, 'new_manga_release');
  const html = templates.newMangaReleaseTemplate(
    n.user!.username,
    n.mangaCustom.title,
    n.mangaCustom.shortDescription,
    n.mangaCustom.imageUrl,
    readUrl,
    n.mangaCustom.organization.name,
    unsubscribeUrl,
  );
  const id = await sendEmail({
    userId: n.user!.id,
    to: n.user!.email,
    subject: `Nuevo Manga: ${n.mangaCustom.title} - ${n.mangaCustom.organization.name}`,
    html,
    emailType: 'new_manga_release',
    metadata: {
      mangaCustomId: n.mangaCustomId,
      organizationId: n.organizationId,
      notificationId: n.id,
    },
    dedupWindowMinutes: 0,
  });
  return !!id;
};

const sendNewSubscriberEmail = async (n: NonNullable<Dispatchable>): Promise<boolean> => {
  if (!n.subscription || !n.organization) return false;
  const planName = n.subscription.subscriptionPlan?.name || 'Plan sin nombre';
  const subscriberUsername = n.subscription.user?.username || 'Usuario';
  const amount = n.subscription.lastAmount != null
    ? `${n.subscription.lastAmount.toFixed(2)} USD`
    : '0 USD';

  const unsubscribeUrl = await getUnsubscribeUrl(n.user!.id, 'new_subscriber_alert');
  const html = templates.newSubscriberAlertTemplate(
    n.user!.username,
    n.organization.name,
    subscriberUsername,
    planName,
    amount,
    unsubscribeUrl,
  );
  const id = await sendEmail({
    userId: n.user!.id,
    to: n.user!.email,
    subject: `Nuevo Suscriptor en ${n.organization.name}!`,
    html,
    emailType: 'new_subscriber_alert',
    metadata: {
      organizationId: n.organizationId,
      subscriptionId: n.subscriptionId,
      notificationId: n.id,
    },
    dedupWindowMinutes: 0,
  });
  return !!id;
};

const sendFailedPaymentEmail = async (n: NonNullable<Dispatchable>): Promise<boolean> => {
  if (!n.subscription || !n.organization) return false;
  const planName = n.subscription.subscriptionPlan?.name || 'Plan sin nombre';
  const subscriberUsername = n.subscription.user?.username || 'Usuario';

  const unsubscribeUrl = await getUnsubscribeUrl(n.user!.id, 'failed_payment_alert');
  const html = templates.failedPaymentAlertTemplate(
    n.user!.username,
    n.organization.name,
    subscriberUsername,
    planName,
    n.subscription.failedPaymentsCount,
    unsubscribeUrl,
  );
  const id = await sendEmail({
    userId: n.user!.id,
    to: n.user!.email,
    subject: `Pago Fallido - ${subscriberUsername} - ${n.organization.name}`,
    html,
    emailType: 'failed_payment_alert',
    metadata: {
      organizationId: n.organizationId,
      subscriptionId: n.subscriptionId,
      notificationId: n.id,
    },
    dedupWindowMinutes: 0,
  });
  return !!id;
};

export const dispatchNotificationEmail = async (notificationId: number): Promise<boolean> => {
  const n = await loadNotification(notificationId);
  if (!n || !n.user || !n.user.emailNotifications) return false;

  const emailType = mapTypeToEmailType(n.type);
  if (!emailType) return false;

  const allowed = await canSendEmail(n.user.id, emailType);
  if (!allowed) return false;

  switch (n.type) {
    case 'new_chapter':
      return sendChapterEmail(n);
    case 'comment_reply':
      return sendCommentReplyEmail(n);
    case 'new_manga':
      return sendNewMangaEmail(n);
    case 'new_subscriber':
      return sendNewSubscriberEmail(n);
    case 'failed_payment':
      return sendFailedPaymentEmail(n);
    default:
      return false;
  }
};
