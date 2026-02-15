import { Resend } from 'resend';
import { prisma } from '../models/prisma';

const resend = new Resend(Bun.env.RESEND_API_KEY);

const FROM_ADDRESS = 'Capibara Traductor <noreply@capibaratraductor.com>';
const BASE_URL = 'https://capibaratraductor.com';

export { BASE_URL };

// ──────────── Rate Limiter ────────────
// Resend allows max 2 requests per second. We use 600ms intervals for safety.
const RATE_LIMIT_INTERVAL_MS = 600;
let lastResendRequestTime = 0;

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastResendRequestTime;
  if (elapsed < RATE_LIMIT_INTERVAL_MS) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_INTERVAL_MS - elapsed));
  }
  lastResendRequestTime = Date.now();
}

// ──────────── Retry with backoff ────────────
const MAX_RETRIES = 2;
const BASE_RETRY_DELAY_MS = 5000;

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isRateLimit = error?.message?.includes('rate limit') ||
        error?.statusCode === 429 ||
        error?.message?.includes('Too many requests');

      if (isRateLimit && attempt < MAX_RETRIES) {
        const jitter = Math.random() * 3000;
        const delay = BASE_RETRY_DELAY_MS + jitter;
        console.warn(`[Email] Rate limit hit, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

// ──────────── Types ────────────
export interface SendEmailOptions {
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

// ──────────── Single Email Send ────────────

/**
 * Core email sending function.
 * Checks master toggle, deduplicates, sends via Resend, and logs.
 * Rate-limited to respect Resend's 2 req/sec limit.
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
    await waitForRateLimit();
    const result = await withRetry(() =>
      resend.emails.send({
        from: FROM_ADDRESS,
        to,
        subject,
        html,
      })
    );

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

// ──────────── Admin / System Email ────────────

/**
 * Send a simple admin notification email (no user context, no logging).
 */
export async function sendAdminEmail(to: string, subject: string, html: string): Promise<void> {
  try {
    await waitForRateLimit();
    await resend.emails.send({ from: FROM_ADDRESS, to, subject, html });
  } catch (error: any) {
    console.error(`[Email] Failed to send admin email to ${to}:`, error?.message || error);
  }
}

// ──────────── Batch Email Send ────────────

/**
 * Send emails in bulk using Resend batch API.
 * Groups up to 100 emails per API call with rate limiting between calls.
 * Pre-filters for preference checks and dedup before sending.
 * Retries on rate limit errors with exponential backoff + jitter.
 */
export async function sendBatchEmails(emails: SendEmailOptions[]): Promise<void> {
  if (emails.length === 0) return;

  // Pre-filter: preference + dedup checks
  const eligible: SendEmailOptions[] = [];

  for (const email of emails) {
    if (!email.skipPreferenceCheck) {
      const user = await prisma.user.findUnique({
        where: { id: email.userId },
        select: { emailNotifications: true },
      });
      if (!user || !user.emailNotifications) continue;
    }

    if (email.dedupWindowMinutes && email.dedupWindowMinutes > 0) {
      const windowStart = new Date(Date.now() - email.dedupWindowMinutes * 60 * 1000);
      const existing = await prisma.emailLog.findFirst({
        where: {
          userId: email.userId,
          emailType: email.emailType,
          createdAt: { gte: windowStart },
        },
      });
      if (existing) continue;
    }

    eligible.push(email);
  }

  if (eligible.length === 0) return;

  console.log(`[Email] Sending batch of ${eligible.length} emails (from ${emails.length} total after filtering)`);

  // Send in chunks of 100 using Resend batch API
  const BATCH_SIZE = 100;

  for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
    const chunk = eligible.slice(i, i + BATCH_SIZE);
    const payloads = chunk.map(e => ({
      from: FROM_ADDRESS,
      to: e.to,
      subject: e.subject,
      html: e.html,
    }));

    try {
      await waitForRateLimit();
      const result = await withRetry(() => resend.batch.send(payloads));
      const ids = (result.data as any)?.data || result.data || [];

      // Log each email as sent
      await Promise.allSettled(
        chunk.map((e, idx) =>
          prisma.emailLog.create({
            data: {
              userId: e.userId,
              emailType: e.emailType,
              subject: e.subject,
              resendId: (ids as any)[idx]?.id || null,
              status: 'sent',
              metadata: e.metadata || undefined,
            },
          })
        )
      );
    } catch (error: any) {
      console.error(`[Email] Batch send failed (${chunk.length} emails):`, error?.message || error);

      // Log all as failed
      await Promise.allSettled(
        chunk.map(e =>
          prisma.emailLog.create({
            data: {
              userId: e.userId,
              emailType: e.emailType,
              subject: e.subject,
              status: 'failed',
              metadata: { error: error?.message, ...(e.metadata || {}) },
            },
          })
        )
      );
    }
  }
}
