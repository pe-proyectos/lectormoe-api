import { Elysia } from "elysia";
import { cron } from "@elysiajs/cron";
import { prisma } from "../../models/prisma";
import { dispatchNotificationEmail } from "../../services/notification-email-dispatcher";

const THIRTY_MIN_MS = 30 * 60 * 1000;

async function processPendingEmails() {
  try {
    const cutoff = new Date(Date.now() - THIRTY_MIN_MS);

    // Cap per-tick batch so a backlog doesn't spike memory or rate-limits.
    const pending = await prisma.notification.findMany({
      where: {
        readAt: null,
        emailSentAt: null,
        createdAt: { lt: cutoff },
      },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });

    if (pending.length === 0) return;

    console.log(`[Notification Cron] Processing ${pending.length} pending email(s)`);
    let sent = 0;
    let failed = 0;
    for (const n of pending) {
      try {
        const ok = await dispatchNotificationEmail(n.id);
        // Always stamp emailSentAt — even if we deliberately skipped (preferences,
        // dedup, missing data). Otherwise the cron retries forever.
        await prisma.notification.update({
          where: { id: n.id },
          data: { emailSentAt: new Date() },
        });
        if (ok) sent++;
      } catch (e) {
        console.error(`[Notification Cron] Failed dispatching notification #${n.id}:`, e);
        failed++;
      }
    }
    console.log(`[Notification Cron] Sent ${sent}, failed ${failed}, total ${pending.length}`);
  } catch (e) {
    console.error("[Notification Cron] Critical error:", e);
  }
}

export const router = () =>
  new Elysia().use(
    cron({
      name: "notification-pending-emails",
      // Every 30 minutes, on the hour and half-hour.
      pattern: "0,30 * * * *",
      run: processPendingEmails,
    }),
  );
