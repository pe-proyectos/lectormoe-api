import { cron } from '@elysiajs/cron'
import { Elysia } from 'elysia'
import { prisma } from '../../models/prisma'
import { dispatchNotificationEmail } from '../../services/notification-email-dispatcher'
import { wrapCron } from '../../util/cron-alert'
import { sendCommentDigests } from '../../services/charca-comment-digest'

const THIRTY_MIN_MS = 30 * 60 * 1000

async function processPendingEmails() {
  try {
    const cutoff = new Date(Date.now() - THIRTY_MIN_MS)

    // Cap per-tick batch so a backlog doesn't spike memory or rate-limits.
    const pending = await prisma.notification.findMany({
      where: {
        readAt: null,
        emailSentAt: null,
        createdAt: { lt: cutoff },
        // Los comentarios de La Charca los agrupa su propio resumen horario:
        // si entraran aquí volverían a salir de uno en uno.
        type: { not: 'charca_comment' }
      },
      orderBy: { createdAt: 'asc' },
      take: 500
    })

    if (pending.length === 0) return

    console.log(
      `[Notification Cron] Processing ${pending.length} pending email(s)`
    )
    let sent = 0
    let failed = 0
    for (const n of pending) {
      try {
        const ok = await dispatchNotificationEmail(n.id)
        // Always stamp emailSentAt — even if we deliberately skipped (preferences,
        // dedup, missing data). Otherwise the cron retries forever.
        await prisma.notification.update({
          where: { id: n.id },
          data: { emailSentAt: new Date() }
        })
        if (ok) sent++
      } catch (e) {
        console.error(
          `[Notification Cron] Failed dispatching notification #${n.id}:`,
          e
        )
        failed++
      }
    }
    console.log(
      `[Notification Cron] Sent ${sent}, failed ${failed}, total ${pending.length}`
    )
  } catch (e) {
    console.error('[Notification Cron] Critical error:', e)
  }
}

// Resumen horario de comentarios de La Charca. Las respuestas directas ya se
// envían al momento; esto agrupa el resto en un solo correo por persona.
async function processCommentDigests() {
  const r = await sendCommentDigests()
  if (r.agrupados) {
    console.log(`[Resumen La Charca] ${r.agrupados} avisos agrupados en ${r.correos} correos`)
  }
}

export const router = () =>
  new Elysia()
    .use(
      cron({
        name: 'notification-pending-emails',
        // Every 30 minutes, on the hour and half-hour.
        pattern: '0,30 * * * *',
        run: wrapCron('notification-pending-emails', processPendingEmails)
      })
    )
    .use(
      cron({
        name: 'charca-comment-digest',
        // Cada hora en punto.
        pattern: '0 * * * *',
        run: wrapCron('charca-comment-digest', processCommentDigests)
      })
    )
