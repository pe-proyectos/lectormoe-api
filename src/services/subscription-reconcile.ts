import { prisma } from '../models/prisma';
import { getSubscriptionByPaypalId, getTransactionsOfSubscription } from '../util/paypal';

// Same fee math as the webhook handler. If you change fees, change both.
function feeBreakdown(amount: number) {
  const paypalFee = Math.max(0.30, amount * 0.029);
  const capibaraFee = amount * 0.05;
  const netAmount = amount - paypalFee - capibaraFee;
  return { paypalFee, capibaraFee, netAmount };
}

// Insert a Subscription row from a PayPal subscription id when the webhook
// arrives for an unknown sub. Returns null if the user can't be matched.
//
// Strategy: PayPal subs carry the subscriber email; we look up by email
// (case-insensitive). If multiple users match, prefer the one that already
// has any subscription on the same plan.
export const reconcileSubscriptionFromPaypal = async (paypalSubscriptionId: string) => {
  const ps = await getSubscriptionByPaypalId(paypalSubscriptionId);
  if (!ps) return null;

  const email = ps.subscriber?.email_address?.toLowerCase();
  if (!email) {
    console.warn(`[reconcile] sub ${paypalSubscriptionId}: no subscriber email on PayPal payload`);
    return null;
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, email: true, slug: true },
  });
  if (!user) {
    console.warn(`[reconcile] sub ${paypalSubscriptionId}: no user with email=${email}`);
    return null;
  }

  const plan = await prisma.subscriptionPlan.findFirst({
    where: { planId: ps.plan_id },
    select: { id: true, organizationId: true, name: true },
  });
  if (!plan) {
    console.warn(`[reconcile] sub ${paypalSubscriptionId}: no plan with paypalPlanId=${ps.plan_id}`);
    return null;
  }

  const billing = ps.billing_info ?? {};
  const created = await prisma.subscription.create({
    data: {
      userId: user.id,
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
  console.log(`[reconcile] inserted Subscription #${created.id} for ${ps.id} (user=${user.slug}, plan=${plan.name})`);
  return created;
};

// For a known subscription, fetch transactions from PayPal and insert any that
// don't have a matching OrganizationTransaction row. Idempotent.
export const reconcileTransactionsForSubscription = async (subscriptionId: number) => {
  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: {
      id: true,
      organizationId: true,
      paypalSubscriptionId: true,
      subscriptionPlan: { select: { name: true } },
    },
  });
  if (!sub || !sub.paypalSubscriptionId) return { inserted: 0, skipped: 0 };

  let txs: any[] = [];
  try {
    txs = (await getTransactionsOfSubscription(sub.paypalSubscriptionId)) ?? [];
  } catch (e) {
    console.warn(`[reconcile] tx fetch failed for sub #${subscriptionId} (${sub.paypalSubscriptionId})`, e);
    return { inserted: 0, skipped: 0 };
  }

  let inserted = 0;
  let skipped = 0;
  for (const t of txs) {
    if (t.status !== 'COMPLETED') continue;
    const exists = await prisma.organizationTransaction.findFirst({
      where: { transactionId: t.id },
      select: { id: true },
    });
    if (exists) { skipped++; continue; }

    const amount = parseFloat(t.amount_with_breakdown?.gross_amount?.value ?? '0');
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const currency = t.amount_with_breakdown?.gross_amount?.currency_code ?? 'USD';
    const { paypalFee, capibaraFee, netAmount } = feeBreakdown(amount);

    await prisma.organizationTransaction.create({
      data: {
        organizationId: sub.organizationId,
        subscriptionId: sub.id,
        origin: 'SUBSCRIPTION',
        description: `Pago de suscripción - ${sub.subscriptionPlan?.name ?? 'Plan'} (reconciliado)`,
        beforeFeesAmount: amount,
        amount: netAmount,
        currency,
        type: 'EARNING',
        status: 'COMPLETED',
        paymentMethod: 'PAYPAL',
        paymentDetails: JSON.stringify({ reconciled: true, paypalTxId: t.id }),
        transactionId: t.id,
        paypalFee,
        capibaraFee,
        transactionDate: new Date(t.time),
      },
    });
    inserted++;
    console.log(`[reconcile] inserted Tx ${t.id} for sub #${subscriptionId}: $${amount} → $${netAmount.toFixed(2)} net`);
  }
  return { inserted, skipped };
};
