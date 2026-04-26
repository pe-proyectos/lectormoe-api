import { Elysia } from 'elysia';
import { cron } from '@elysiajs/cron';
import { prisma } from '../../models/prisma';
import { getSubscriptionByPaypalId } from '../../util/paypal';
import { reconcileTransactionsForSubscription } from '../../services/subscription-reconcile';

// Runs every day at 02:00 UTC. For each ACTIVE subscription, refreshes status
// from PayPal AND inserts any missing OrganizationTransactions. This catches
// dropped webhooks (Beli case: $2 charged but no tx row).
async function processSubscriptionReconcile() {
  console.log('[Subscription Reconcile] starting daily run');
  const subs = await prisma.subscription.findMany({
    where: { active: true, paypalSubscriptionId: { not: null } },
    select: { id: true, paypalSubscriptionId: true },
  });
  console.log(`[Subscription Reconcile] ${subs.length} active subs`);

  let txInserted = 0;
  let statusChanged = 0;
  for (const s of subs) {
    if (!s.paypalSubscriptionId) continue;
    try {
      // 1) Resync status from PayPal — drops subs that PayPal cancelled but
      //    we never saw the webhook for.
      const ps = await getSubscriptionByPaypalId(s.paypalSubscriptionId);
      if (ps) {
        const wantActive = ps.status === 'ACTIVE';
        const billing = ps.billing_info ?? {};
        await prisma.subscription.update({
          where: { id: s.id },
          data: {
            status: ps.status,
            active: wantActive,
            cycleExecutions: (billing.cycle_executions ?? []).reduce((a: number, c: any) => a + c.cycles_completed, 0),
            failedPaymentsCount: billing.failed_payments_count,
            nextPayment: billing.next_billing_time ? new Date(billing.next_billing_time) : null,
            lastPayment: billing.last_payment?.time ? new Date(billing.last_payment.time) : undefined,
            lastAmount: billing.last_payment?.amount?.value ? parseFloat(billing.last_payment.amount.value) : undefined,
          },
        });
        if (wantActive !== true) statusChanged++;
      }

      // 2) Reconcile missing transactions.
      const r = await reconcileTransactionsForSubscription(s.id);
      txInserted += r.inserted;
    } catch (e) {
      console.error(`[Subscription Reconcile] sub #${s.id} failed`, e);
    }
  }
  console.log(`[Subscription Reconcile] done — ${txInserted} txs inserted, ${statusChanged} subs flipped to inactive`);
}

export const router = () =>
  new Elysia().use(
    cron({
      name: 'subscription-reconcile-daily',
      pattern: '0 2 * * *',
      run: processSubscriptionReconcile,
    })
  );
