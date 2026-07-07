import { cron } from '@elysiajs/cron'
import { Elysia } from 'elysia'
import { prisma } from '../../models/prisma'
import { reconcileTransactionsForSubscription } from '../../services/subscription-reconcile'
import { getSubscriptionByPaypalId } from '../../util/paypal'
import { computePaidPeriodEnd } from '../../util/subscription-period'

// Runs every day at 02:00 UTC. Refreshes status from PayPal for:
//   • active subscriptions (normal case)
//   • cancelled/suspended subs still in their paid grace period (endDate > now)
// Also inserts any missing OrganizationTransactions (catches dropped webhooks).
async function processSubscriptionReconcile() {
  const now = new Date()
  console.log('[Subscription Reconcile] starting daily run')
  const subs = await prisma.subscription.findMany({
    where: {
      OR: [
        { active: true },
        // Cancelled subs that still have paid time remaining
        { endDate: { gt: now } }
      ]
    },
    select: {
      id: true,
      paypalSubscriptionId: true,
      endDate: true,
      lastPayment: true,
      subscriptionPlan: { select: { interval: true } }
    }
  })
  console.log(`[Subscription Reconcile] ${subs.length} subs to process`)

  let txInserted = 0
  let statusChanged = 0
  for (const s of subs) {
    if (!s.paypalSubscriptionId) continue
    try {
      // 1) Resync status from PayPal.
      const ps = await getSubscriptionByPaypalId(s.paypalSubscriptionId)
      if (ps) {
        const paypalActive = ps.status === 'ACTIVE'
        const billing = ps.billing_info ?? {}

        // If PayPal cancelled/suspended but the user still has paid time left,
        // keep active=true until endDate passes. When the webhook was dropped and
        // endDate was never set, derive it from the last payment + plan interval.
        let endDate = s.endDate
        if (!paypalActive && endDate === null) {
          endDate = computePaidPeriodEnd({
            nextBillingTime: billing.next_billing_time,
            lastPaymentTime: billing.last_payment?.time ?? s.lastPayment,
            interval: s.subscriptionPlan?.interval
          })
        }
        const keepActiveForGrace =
          !paypalActive && endDate !== null && endDate > now
        const wantActive = paypalActive || keepActiveForGrace

        await prisma.subscription.update({
          where: { id: s.id },
          data: {
            status: ps.status,
            active: wantActive,
            // Persist the derived grace endDate so the UI can show it and the
            // next run flips access off exactly when it expires. For ACTIVE subs
            // clear any stale endDate left over from a previous cancellation.
            endDate: paypalActive ? null : endDate,
            cycleExecutions: (billing.cycle_executions ?? []).reduce(
              (a: number, c: any) => a + c.cycles_completed,
              0
            ),
            failedPaymentsCount: billing.failed_payments_count,
            nextPayment: billing.next_billing_time
              ? new Date(billing.next_billing_time)
              : null,
            lastPayment: billing.last_payment?.time
              ? new Date(billing.last_payment.time)
              : undefined,
            lastAmount: billing.last_payment?.amount?.value
              ? parseFloat(billing.last_payment.amount.value)
              : undefined
          }
        })
        if (!wantActive) statusChanged++
      }

      // 2) Reconcile missing transactions (only needed for active subs).
      if (s.endDate === null || s.endDate > now) {
        const r = await reconcileTransactionsForSubscription(s.id)
        txInserted += r.inserted
      }
    } catch (e) {
      console.error(`[Subscription Reconcile] sub #${s.id} failed`, e)
    }
  }
  console.log(
    `[Subscription Reconcile] done — ${txInserted} txs inserted, ${statusChanged} subs flipped to inactive`
  )
}

export const router = () =>
  new Elysia().use(
    cron({
      name: 'subscription-reconcile-daily',
      pattern: '0 2 * * *',
      run: processSubscriptionReconcile
    })
  )
