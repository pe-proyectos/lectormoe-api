/**
 * Reconciliación puntual para Beli (user 7014):
 *   - Inserta la subscription huérfana I-U6TV6R80RXCF (Acólitos $2, ACTIVE).
 *   - Inserta las 2 OrganizationTransactions perdidas (782... y 57013...).
 *   - Suspende #88 y #89 si PayPal las reporta inactivas (sanity).
 *
 * Idempotente: salta inserts si ya existen.
 */
import { prisma } from '../models/prisma';
import { getSubscriptionByPaypalId, getTransactionsOfSubscription } from '../util/paypal';

const ORPHAN_PAYPAL_SUB = 'I-U6TV6R80RXCF';
const MISSING_TX_FOR_SUB_89 = '782324998H6604333';
const MISSING_TX_FOR_NEW_SUB = '57013979RT777244T';

const PLAN_ACOLITOS_PAYPAL = 'P-91273330A8443900NNHB7Z4I';

function feeBreakdown(amount: number) {
  // Mismo cálculo que el webhook handler en paypal_webhook.ts
  const paypalFee = Math.max(0.30, amount * 0.029);
  const capibaraFee = amount * 0.05;
  const netAmount = amount - paypalFee - capibaraFee;
  return { paypalFee, capibaraFee, netAmount };
}

async function ensureSubscription(plan: any, userId: number) {
  const existing = await prisma.subscription.findFirst({
    where: { paypalSubscriptionId: ORPHAN_PAYPAL_SUB },
    select: { id: true },
  });
  if (existing) {
    console.log(`  Sub ${ORPHAN_PAYPAL_SUB} already exists as #${existing.id}`);
    return existing.id;
  }
  const ps = await getSubscriptionByPaypalId(ORPHAN_PAYPAL_SUB);
  if (!ps) throw new Error('PayPal sub not found');
  const billing = ps.billing_info ?? {};
  const created = await prisma.subscription.create({
    data: {
      userId,
      subscriptionPlanId: plan.id,
      organizationId: plan.organizationId,
      paypalSubscriptionId: ps.id,
      status: ps.status,
      startDate: new Date(ps.start_time),
      active: ps.status === 'ACTIVE',
      cycleExecutions: (billing.cycle_executions ?? []).reduce((a: number, c: any) => a + c.cycles_completed, 0),
      failedPaymentsCount: billing.failed_payments_count,
      nextPayment: billing.next_billing_time ? new Date(billing.next_billing_time) : null,
      lastPayment: billing.last_payment?.time ? new Date(billing.last_payment.time) : null,
      lastAmount: parseFloat(billing.last_payment?.amount?.value ?? '0'),
    },
  });
  console.log(`  ✅ Created Subscription #${created.id} for ${ORPHAN_PAYPAL_SUB} (status=${ps.status})`);
  return created.id;
}

async function ensureTx(opts: { paypalTxId: string; subscriptionId: number; planName: string; amount: number; currency: string; time: string }) {
  const exists = await prisma.organizationTransaction.findFirst({
    where: { transactionId: opts.paypalTxId },
    select: { id: true },
  });
  if (exists) {
    console.log(`  Tx ${opts.paypalTxId} already exists as #${exists.id}`);
    return;
  }
  const sub = await prisma.subscription.findUnique({
    where: { id: opts.subscriptionId },
    select: { organizationId: true },
  });
  if (!sub) throw new Error(`Subscription #${opts.subscriptionId} not found`);
  const { paypalFee, capibaraFee, netAmount } = feeBreakdown(opts.amount);
  const created = await prisma.organizationTransaction.create({
    data: {
      organizationId: sub.organizationId,
      subscriptionId: opts.subscriptionId,
      origin: 'SUBSCRIPTION',
      description: `Pago de suscripción - ${opts.planName} (reconciliado)`,
      beforeFeesAmount: opts.amount,
      amount: netAmount,
      currency: opts.currency,
      type: 'EARNING',
      status: 'COMPLETED',
      paymentMethod: 'PAYPAL',
      paymentDetails: JSON.stringify({ reconciled: true, paypalTxId: opts.paypalTxId }),
      transactionId: opts.paypalTxId,
      paypalFee,
      capibaraFee,
      transactionDate: new Date(opts.time),
    },
  });
  console.log(`  ✅ Created Tx #${created.id} ${opts.paypalTxId} ($${opts.amount} → $${netAmount.toFixed(2)} net)`);
}

async function main() {
  const userId = 7014;
  const plan = await prisma.subscriptionPlan.findFirst({
    where: { planId: PLAN_ACOLITOS_PAYPAL },
    select: { id: true, organizationId: true, name: true },
  });
  if (!plan) throw new Error('Acólitos plan not found in DB');

  console.log('=== 1) Reconcile orphan subscription ===');
  const newSubId = await ensureSubscription(plan, userId);

  console.log('\n=== 2) Reconcile missing transactions ===');
  // For sub #89 (already in DB)
  await ensureTx({
    paypalTxId: MISSING_TX_FOR_SUB_89,
    subscriptionId: 89,
    planName: 'Acólitos de Templo de Jeny',
    amount: 2.0,
    currency: 'USD',
    time: '2026-04-25T06:16:25Z',
  });
  // For the new orphan sub
  await ensureTx({
    paypalTxId: MISSING_TX_FOR_NEW_SUB,
    subscriptionId: newSubId,
    planName: 'Acólitos de Templo de Jeny',
    amount: 2.0,
    currency: 'USD',
    time: '2026-04-25T15:17:51Z',
  });

  console.log('\n=== 3) Refresh state of all 3 subs from PayPal (sanity) ===');
  for (const pid of ['I-19PMYHJHTSBA', 'I-J3TK4EJ4VKCM', ORPHAN_PAYPAL_SUB]) {
    const ps = await getSubscriptionByPaypalId(pid);
    const local = await prisma.subscription.findFirst({ where: { paypalSubscriptionId: pid } });
    if (!ps || !local) continue;
    const wantActive = ps.status === 'ACTIVE';
    if (local.active !== wantActive || local.status !== ps.status) {
      await prisma.subscription.update({
        where: { id: local.id },
        data: {
          status: ps.status,
          active: wantActive,
        },
      });
      console.log(`  synced ${pid}: status=${ps.status} active=${wantActive}`);
    } else {
      console.log(`  ${pid}: already in sync (status=${ps.status})`);
    }
  }

  console.log('\n✅ Done.');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
