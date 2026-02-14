import { prisma } from '../models/prisma';
import { BASE_URL } from './email';

/** Email preference field names that map to email types */
const EMAIL_TYPE_TO_PREFERENCE: Record<string, string> = {
  new_chapter_alert: 'newChapterAlert',
  new_manga_release: 'newMangaRelease',
  daily_digest: 'dailyDigest',
  weekly_reading_summary: 'weeklyReadingSummary',
  monthly_recap: 'weeklyReadingSummary',
  subscription_reminder: 'subscriptionReminders',
  reading_streak: 'readingStreakMilestones',
  achievement: 'readingStreakMilestones',
  top_reader: 'readingStreakMilestones',
  re_engagement: 'reEngagement',
  comment_reply: 'commentReplyAlert',
  recommendations: 'recommendations',
  weekly_org_report: 'weeklyOrgReport',
  new_subscriber_alert: 'newSubscriberAlert',
  revenue_alert: 'revenueAlert',
  content_performance: 'contentPerformance',
  failed_payment_alert: 'failedPaymentAlert',
};

/**
 * Gets or creates default email preferences for a user.
 */
export async function getOrCreateEmailPreference(userId: number) {
  const existing = await prisma.emailPreference.findUnique({
    where: { userId },
  });

  if (existing) return existing;

  return prisma.emailPreference.create({
    data: { userId },
  });
}

/**
 * Updates email preferences for a user (partial update).
 */
export async function updateEmailPreference(userId: number, changes: Record<string, boolean>) {
  // Ensure record exists
  await getOrCreateEmailPreference(userId);

  // Only allow known fields
  const allowedFields = Object.values(EMAIL_TYPE_TO_PREFERENCE);
  const safeChanges: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(changes)) {
    if (allowedFields.includes(key) && typeof value === 'boolean') {
      safeChanges[key] = value;
    }
  }

  return prisma.emailPreference.update({
    where: { userId },
    data: safeChanges,
  });
}

/**
 * Checks if a specific email type can be sent to a user.
 * Checks both master toggle and specific preference.
 * Returns false if user doesn't want this email type.
 */
export async function canSendEmail(userId: number, emailType: string): Promise<boolean> {
  // Security emails always go through
  const securityTypes = ['password_reset', 'email_verification'];
  if (securityTypes.includes(emailType)) return true;

  // Check master toggle
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailNotifications: true },
  });
  if (!user || !user.emailNotifications) return false;

  // Check specific preference
  const preferenceField = EMAIL_TYPE_TO_PREFERENCE[emailType];
  if (!preferenceField) return true; // Unknown type, allow by default

  const prefs = await getOrCreateEmailPreference(userId);
  return (prefs as any)[preferenceField] === true;
}

/**
 * Gets or creates a permanent unsubscribe token for a user.
 * Tokens are reused across emails so old links always work.
 * If category is provided, generates a category-specific unsubscribe URL.
 */
export async function getUnsubscribeUrl(userId: number, category?: string): Promise<string> {
  const existing = await prisma.unsubscribeToken.findFirst({
    where: { userId },
  });

  let token: string;
  if (existing) {
    token = existing.token;
  } else {
    token = crypto.randomUUID();
    await prisma.unsubscribeToken.create({
      data: { userId, token },
    });
  }

  const params = new URLSearchParams({ token });
  if (category) params.append('category', category);
  return `${BASE_URL}/unsubscribe?${params}`;
}

/**
 * Process an unsubscribe action.
 * If category is provided, only disable that specific preference.
 * If no category, disable the master toggle.
 */
export async function processUnsubscribe(
  token: string,
  category?: string
): Promise<{ success: boolean; username?: string }> {
  const record = await prisma.unsubscribeToken.findUnique({
    where: { token },
    include: { user: { select: { id: true, username: true } } },
  });

  if (!record) return { success: false };

  const userId = record.user.id;

  if (category && EMAIL_TYPE_TO_PREFERENCE[category]) {
    // Disable specific category
    const field = EMAIL_TYPE_TO_PREFERENCE[category];
    await getOrCreateEmailPreference(userId);
    await prisma.emailPreference.update({
      where: { userId },
      data: { [field]: false },
    });
  } else {
    // Disable master toggle
    await prisma.user.update({
      where: { id: userId },
      data: { emailNotifications: false },
    });
  }

  return { success: true, username: record.user.username };
}
