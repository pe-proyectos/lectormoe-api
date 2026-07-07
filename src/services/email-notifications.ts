/**
 * High-level email notification triggers.
 * These compose the email service + templates + preferences.
 */
import { prisma } from '../models/prisma';
import { sendEmail, sendBatchEmails, BASE_URL } from './email';
import { canSendEmail, getUnsubscribeUrl } from './email-preferences';
import * as templates from './email-templates';

// ──────────── Security Emails (always sent) ────────────

export async function sendPasswordResetEmail(
  userId: number,
  email: string,
  username: string,
  token: string
): Promise<string | null> {
  const resetUrl = `${BASE_URL}/reset-password?token=${token}`;
  const html = templates.passwordResetTemplate(username, resetUrl);

  return sendEmail({
    userId,
    to: email,
    subject: 'Restablecer Contrasena - Capibara Traductor',
    html,
    emailType: 'password_reset',
    skipPreferenceCheck: true,
    dedupWindowMinutes: 5,
  });
}

export async function sendEmailVerificationEmail(
  userId: number,
  email: string,
  username: string,
  token: string
): Promise<string | null> {
  const verifyUrl = `${BASE_URL}/verify-email?token=${token}`;
  const html = templates.emailVerificationTemplate(username, verifyUrl);

  return sendEmail({
    userId,
    to: email,
    subject: 'Verifica tu Email - Capibara Traductor',
    html,
    emailType: 'email_verification',
    skipPreferenceCheck: true,
    dedupWindowMinutes: 5,
  });
}

// ──────────── User Onboarding ────────────

export async function sendWelcomeEmail(
  userId: number,
  email: string,
  username: string
): Promise<string | null> {
  const unsubscribeUrl = await getUnsubscribeUrl(userId);
  const html = templates.welcomeTemplate(username, BASE_URL, unsubscribeUrl);

  return sendEmail({
    userId,
    to: email,
    subject: 'Bienvenido a Capibara Traductor!',
    html,
    emailType: 'welcome',
    skipPreferenceCheck: true,
  });
}

export async function sendWelcomeAndVerifyEmail(
  userId: number,
  email: string,
  username: string,
  token: string
): Promise<string | null> {
  const verifyUrl = `${BASE_URL}/verify-email?token=${token}`;
  const html = templates.welcomeAndVerifyTemplate(username, verifyUrl, BASE_URL);

  return sendEmail({
    userId,
    to: email,
    subject: 'Bienvenido a Capibara Traductor - Verifica tu Email',
    html,
    emailType: 'welcome_and_verify',
    skipPreferenceCheck: true,
    dedupWindowMinutes: 5,
  });
}

// ──────────── Reader Notifications ────────────

/**
 * Sends new chapter alert to all users who favorited the manga.
 * Called after chapter creation.
 */
export async function sendNewChapterAlert(
  mangaCustomId: number,
  chapterId: number,
  organizationId: number
): Promise<void> {
  const [chapter, mangaCustom, organization] = await Promise.all([
    prisma.chapter.findUnique({ where: { id: chapterId } }),
    prisma.mangaCustom.findUnique({
      where: { id: mangaCustomId },
      include: { manga: true },
    }),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, slug: true },
    }),
  ]);

  if (!chapter || !mangaCustom || !organization) return;

  // Find all users who favorited this manga and have notifications enabled
  const favorites = await prisma.favorite.findMany({
    where: { mangaCustomId },
    include: {
      user: {
        select: { id: true, email: true, username: true, emailNotifications: true },
      },
    },
  });

  const eligibleUsers = [];
  for (const fav of favorites) {
    if (fav.user.emailNotifications) {
      const allowed = await canSendEmail(fav.user.id, 'new_chapter_alert');
      if (allowed) eligibleUsers.push(fav.user);
    }
  }

  if (eligibleUsers.length === 0) return;

  const mangaSlug = mangaCustom.manga.slug;
  const readUrl = `${BASE_URL}/${organization.slug}/manga/${mangaSlug}/chapters/${chapter.number}`;

  const emails = await Promise.all(
    eligibleUsers.map(async (user) => {
      const unsubscribeUrl = await getUnsubscribeUrl(user.id, 'new_chapter_alert');
      const html = templates.newChapterAlertTemplate(
        user.username,
        mangaCustom.title,
        chapter.number,
        chapter.title,
        mangaCustom.imageUrl,
        readUrl,
        organization.name,
        unsubscribeUrl
      );
      return {
        userId: user.id,
        to: user.email,
        subject: `Nuevo Cap. ${chapter.number} de ${mangaCustom.title} - ${organization.name}`,
        html,
        emailType: 'new_chapter_alert',
        metadata: { mangaCustomId, chapterId, organizationId },
        dedupWindowMinutes: 60,
      };
    })
  );

  await sendBatchEmails(emails);
  console.log(`[Email] Sent new chapter alert for ${mangaCustom.title} Cap.${chapter.number} to ${emails.length} users`);
}

/**
 * Sends new manga release alert to all followers of the organization.
 * Called after manga-custom creation.
 */
export async function sendNewMangaReleaseAlert(
  mangaCustomId: number,
  organizationId: number
): Promise<void> {
  const [mangaCustom, organization] = await Promise.all([
    prisma.mangaCustom.findUnique({
      where: { id: mangaCustomId },
      include: { manga: true },
    }),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, slug: true },
    }),
  ]);

  if (!mangaCustom || !organization) return;

  const followers = await prisma.organizationFollower.findMany({
    where: { organizationId },
    include: {
      user: {
        select: { id: true, email: true, username: true, emailNotifications: true },
      },
    },
  });

  const eligibleUsers = [];
  for (const f of followers) {
    if (f.user.emailNotifications) {
      const allowed = await canSendEmail(f.user.id, 'new_manga_release');
      if (allowed) eligibleUsers.push(f.user);
    }
  }

  if (eligibleUsers.length === 0) return;

  const readUrl = `${BASE_URL}/${organization.slug}/manga/${mangaCustom.manga.slug}`;

  const emails = await Promise.all(
    eligibleUsers.map(async (user) => {
      const unsubscribeUrl = await getUnsubscribeUrl(user.id, 'new_manga_release');
      const html = templates.newMangaReleaseTemplate(
        user.username,
        mangaCustom.title,
        mangaCustom.shortDescription,
        mangaCustom.imageUrl,
        readUrl,
        organization.name,
        unsubscribeUrl
      );
      return {
        userId: user.id,
        to: user.email,
        subject: `Nuevo Manga: ${mangaCustom.title} - ${organization.name}`,
        html,
        emailType: 'new_manga_release',
        metadata: { mangaCustomId, organizationId },
        dedupWindowMinutes: 60,
      };
    })
  );

  await sendBatchEmails(emails);
  console.log(`[Email] Sent new manga release alert for ${mangaCustom.title} to ${emails.length} users`);
}

/**
 * Sends new joint chapter alert to users who favorited the joint or any
 * related MangaCustom from an ACCEPTED member org.
 */
export async function sendNewJointChapterAlert(
  jointId: number,
  chapterId: number
): Promise<void> {
  const [chapter, joint] = await Promise.all([
    prisma.chapter.findUnique({ where: { id: chapterId } }),
    prisma.mangaJoint.findUnique({
      where: { id: jointId },
      include: {
        members: {
          where: { status: 'ACCEPTED' },
          select: { organizationId: true },
        },
      },
    }),
  ]);

  if (!chapter || !joint) return;

  const memberOrgIds = joint.members.map((m) => m.organizationId);

  // Collect users: direct joint favorites + favorites on any member org's MangaCustom for same manga
  const [jointFavorites, mangaCustomFavorites] = await Promise.all([
    prisma.favorite.findMany({
      where: { jointId },
      include: {
        user: { select: { id: true, email: true, username: true, emailNotifications: true } },
      },
    }),
    prisma.favorite.findMany({
      where: {
        mangaCustom: {
          mangaId: joint.mangaId,
          organizationId: { in: memberOrgIds },
        },
      },
      include: {
        user: { select: { id: true, email: true, username: true, emailNotifications: true } },
      },
    }),
  ]);

  // Deduplicate by userId
  const userMap = new Map<number, { id: number; email: string; username: string }>();
  for (const fav of [...jointFavorites, ...mangaCustomFavorites]) {
    if (fav.user.emailNotifications && !userMap.has(fav.user.id)) {
      userMap.set(fav.user.id, fav.user);
    }
  }

  const eligibleUsers: { id: number; email: string; username: string }[] = [];
  for (const u of userMap.values()) {
    const allowed = await canSendEmail(u.id, 'new_chapter_alert');
    if (allowed) eligibleUsers.push(u);
  }

  if (eligibleUsers.length === 0) return;

  const readUrl = `${BASE_URL}/joint/manga/${joint.slug}/chapters/${chapter.number}`;
  const orgNames = joint.members.length > 0
    ? `Joint (${joint.members.length} scans)`
    : 'Joint';

  const emails = await Promise.all(
    eligibleUsers.map(async (user) => {
      const unsubscribeUrl = await getUnsubscribeUrl(user.id, 'new_chapter_alert');
      const html = templates.newChapterAlertTemplate(
        user.username,
        joint.title,
        chapter.number,
        chapter.title,
        joint.imageUrl,
        readUrl,
        orgNames,
        unsubscribeUrl
      );
      return {
        userId: user.id,
        to: user.email,
        subject: `Nuevo Cap. ${chapter.number} de ${joint.title} - Joint`,
        html,
        emailType: 'new_chapter_alert',
        metadata: { jointId, chapterId },
        dedupWindowMinutes: 60,
      };
    })
  );

  await sendBatchEmails(emails);
  console.log(`[Email] Sent joint chapter alert for ${joint.title} Cap.${chapter.number} to ${emails.length} users`);
}

// ──────────── Staff Notifications ────────────

/**
 * Sends new subscriber notification to organization staff.
 */
export async function sendNewSubscriberNotification(
  organizationId: number,
  subscriberUserId: number,
  planName: string,
  amount: string
): Promise<void> {
  const [organization, subscriber] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    }),
    prisma.user.findUnique({
      where: { id: subscriberUserId },
      select: { username: true },
    }),
  ]);

  if (!organization || !subscriber) return;

  // Find staff members
  const staffPermissions = await prisma.permission.findMany({
    where: {
      organizationId,
      canSeeAdminPanel: true,
    },
    include: {
      user: {
        select: { id: true, email: true, username: true, emailNotifications: true },
      },
    },
  });

  const eligibleStaff = [];
  for (const p of staffPermissions) {
    if (p.user.emailNotifications) {
      const allowed = await canSendEmail(p.user.id, 'new_subscriber_alert');
      if (allowed) eligibleStaff.push(p.user);
    }
  }

  if (eligibleStaff.length === 0) return;

  const emails = await Promise.all(
    eligibleStaff.map(async (staff) => {
      const unsubscribeUrl = await getUnsubscribeUrl(staff.id, 'new_subscriber_alert');
      const html = templates.newSubscriberAlertTemplate(
        staff.username,
        organization.name,
        subscriber.username,
        planName,
        amount,
        unsubscribeUrl
      );
      return {
        userId: staff.id,
        to: staff.email,
        subject: `Nuevo Suscriptor en ${organization.name}!`,
        html,
        emailType: 'new_subscriber_alert',
        metadata: { organizationId, subscriberUserId },
        dedupWindowMinutes: 5,
      };
    })
  );

  await sendBatchEmails(emails);
}

/**
 * Sends failed payment alert to organization staff.
 */
export async function sendFailedPaymentAlert(
  organizationId: number,
  subscriptionId: number
): Promise<void> {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      user: { select: { id: true, email: true, username: true } },
      subscriptionPlan: { select: { name: true } },
      organization: { select: { name: true } },
    },
  });

  if (!subscription || !subscription.organization) return;

  // Alert staff
  const staffPermissions = await prisma.permission.findMany({
    where: {
      organizationId,
      canSeeAdminPanel: true,
    },
    include: {
      user: {
        select: { id: true, email: true, username: true, emailNotifications: true },
      },
    },
  });

  const eligibleStaff = [];
  for (const p of staffPermissions) {
    if (p.user.emailNotifications) {
      const allowed = await canSendEmail(p.user.id, 'failed_payment_alert');
      if (allowed) eligibleStaff.push(p.user);
    }
  }

  const emails = await Promise.all(
    eligibleStaff.map(async (staff) => {
      const unsubscribeUrl = await getUnsubscribeUrl(staff.id, 'failed_payment_alert');
      const html = templates.failedPaymentAlertTemplate(
        staff.username,
        subscription.organization!.name,
        subscription.user.username,
        subscription.subscriptionPlan.name,
        subscription.failedPaymentsCount,
        unsubscribeUrl
      );
      return {
        userId: staff.id,
        to: staff.email,
        subject: `Pago Fallido - ${subscription.user.username} - ${subscription.organization!.name}`,
        html,
        emailType: 'failed_payment_alert',
        metadata: { organizationId, subscriptionId },
        dedupWindowMinutes: 60,
      };
    })
  );

  if (emails.length > 0) await sendBatchEmails(emails);

  // Also notify the user
  const userAllowed = await canSendEmail(subscription.user.id, 'subscription_reminder');
  if (userAllowed) {
    const unsubscribeUrl = await getUnsubscribeUrl(subscription.user.id, 'subscription_reminder');
    const html = templates.subscriptionReminderTemplate(
      subscription.user.username,
      subscription.subscriptionPlan.name,
      subscription.organization.name,
      'Tu ultimo pago no pudo ser procesado. Por favor, verifica tu metodo de pago para mantener tu suscripcion activa.',
      unsubscribeUrl
    );
    await sendEmail({
      userId: subscription.user.id,
      to: subscription.user.email,
      subject: `Problema con tu pago - ${subscription.organization.name}`,
      html,
      emailType: 'subscription_reminder',
      metadata: { subscriptionId },
      dedupWindowMinutes: 1440, // Once per day
    });
  }
}

// ──────────── Community Notifications ────────────

/**
 * Sends comment reply notification to the parent comment author.
 * Called after a reply comment is created.
 */
export async function sendCommentReplyNotification(
  commentId: number,
  parentCommentId: number
): Promise<void> {
  const [reply, parentComment] = await Promise.all([
    prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        user: { select: { id: true, username: true } },
        organization: { select: { slug: true } },
      },
    }),
    prisma.comment.findUnique({
      where: { id: parentCommentId },
      include: {
        user: { select: { id: true, email: true, username: true, emailNotifications: true } },
      },
    }),
  ]);

  if (!reply || !parentComment) return;

  // Skip if self-reply
  if (reply.user.id === parentComment.user.id) return;

  // Check preferences
  if (!parentComment.user.emailNotifications) return;
  const allowed = await canSendEmail(parentComment.user.id, 'comment_reply');
  if (!allowed) return;

  // Build thread URL from comment identifier
  // Format: {mangaSlug}_{chapterNumber} or just {mangaSlug}
  const identifier = reply.identifier;
  const lastUnderscore = identifier.lastIndexOf('_');
  let threadUrl: string;

  // \d+(\.\d+)? y no \d+: los capítulos decimales (10.5) rompían el link
  if (lastUnderscore > 0 && /^\d+(\.\d+)?$/.test(identifier.slice(lastUnderscore + 1))) {
    const mangaSlug = identifier.slice(0, lastUnderscore);
    const chapterNumber = identifier.slice(lastUnderscore + 1);
    threadUrl = `${BASE_URL}/${reply.organization.slug}/manga/${mangaSlug}/chapters/${chapterNumber}`;
  } else {
    threadUrl = `${BASE_URL}/${reply.organization.slug}/manga/${identifier}`;
  }

  const unsubscribeUrl = await getUnsubscribeUrl(parentComment.user.id, 'comment_reply');

  const html = templates.commentReplyTemplate(
    parentComment.user.username,
    reply.user.username,
    parentComment.comment,
    reply.comment,
    threadUrl,
    unsubscribeUrl
  );

  await sendEmail({
    userId: parentComment.user.id,
    to: parentComment.user.email,
    subject: `${reply.user.username} respondio a tu comentario - Capibara Traductor`,
    html,
    emailType: 'comment_reply',
    metadata: { commentId, parentCommentId },
    dedupWindowMinutes: 1,
  });
}
