import { Resend } from 'resend';
import { prisma } from '../models/prisma';

const resend = new Resend(Bun.env.RESEND_API_KEY);

const FROM_ADDRESS = 'Capibara Traductor <noreply@capibaratraductor.com>';
const BASE_URL = 'https://capibaratraductor.com';

export { BASE_URL };

interface SendEmailOptions {
  userId: number;
  to: string;
  subject: string;
  html: string;
  emailType: string;
  metadata?: Record<string, any>;
  /** Skip preference/master toggle check (for security emails like password reset) */
  skipPreferenceCheck?: boolean;
  /** Deduplication window in minutes. 0 = no dedup */
  dedupWindowMinutes?: number;
}

/**
 * Core email sending function.
 * Checks master toggle, deduplicates, sends via Resend, and logs.
 */
export async function sendEmail(options: SendEmailOptions): Promise<string | null> {
  const {
    userId,
    to,
    subject,
    html,
    emailType,
    metadata,
    skipPreferenceCheck = false,
    dedupWindowMinutes = 0,
  } = options;

  // Check master toggle unless skipped (security emails)
  if (!skipPreferenceCheck) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { emailNotifications: true },
    });
    if (!user || !user.emailNotifications) {
      return null;
    }
  }

  // Deduplication check
  if (dedupWindowMinutes > 0) {
    const windowStart = new Date(Date.now() - dedupWindowMinutes * 60 * 1000);
    const existing = await prisma.emailLog.findFirst({
      where: {
        userId,
        emailType,
        createdAt: { gte: windowStart },
      },
    });
    if (existing) {
      return null;
    }
  }

  try {
    const result = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
    });

    const resendId = result.data?.id || null;

    await prisma.emailLog.create({
      data: {
        userId,
        emailType,
        subject,
        resendId,
        status: 'sent',
        metadata: metadata || undefined,
      },
    });

    return resendId;
  } catch (error: any) {
    console.error(`[Email] Failed to send ${emailType} to user ${userId}:`, error?.message || error);

    await prisma.emailLog.create({
      data: {
        userId,
        emailType,
        subject,
        status: 'failed',
        metadata: { error: error?.message, ...(metadata || {}) },
      },
    }).catch(() => {});

    return null;
  }
}

/**
 * Send emails to multiple users with concurrency control.
 * Used for fan-out notifications (e.g., new chapter alert to all followers).
 */
export async function sendBatchEmails(
  emails: SendEmailOptions[],
  concurrency = 10
): Promise<void> {
  for (let i = 0; i < emails.length; i += concurrency) {
    const batch = emails.slice(i, i + concurrency);
    await Promise.allSettled(batch.map(sendEmail));
    // Small delay between batches to respect rate limits
    if (i + concurrency < emails.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}
