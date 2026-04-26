import { getSubscriptionByPaypalId, getTransactionsOfSubscription } from '../util/paypal';

const ORPHAN = 'I-U6TV6R80RXCF';

async function main() {
  console.log(`=== PayPal sub ${ORPHAN} ===`);
  const ps = await getSubscriptionByPaypalId(ORPHAN);
  if (!ps) { console.log('  not found in PayPal'); return; }
  console.log(`  status: ${ps.status}`);
  console.log(`  start: ${ps.start_time}  update: ${ps.update_time}`);
  console.log(`  plan_id: ${ps.plan_id}`);
  console.log(`  subscriber: ${JSON.stringify(ps.subscriber)}`);
  const bi = ps.billing_info;
  if (bi) {
    console.log(`  failedPayments: ${bi.failed_payments_count}  outstanding: ${bi.outstanding_balance?.value}`);
    console.log(`  lastPayment: ${bi.last_payment ? `${bi.last_payment.amount?.value} @ ${bi.last_payment.time}` : '-'}`);
    console.log(`  nextPayment: ${bi.next_billing_time ?? '-'}`);
  }
  const txs = await getTransactionsOfSubscription(ORPHAN);
  console.log(`\n  PayPal transactions: ${txs?.length ?? 0}`);
  for (const t of txs ?? []) {
    console.log(`  - ${t.id}  status=${t.status}  amount=${t.amount_with_breakdown?.gross_amount?.value} ${t.amount_with_breakdown?.gross_amount?.currency_code}  fee=${t.amount_with_breakdown?.fee_amount?.value}  net=${t.amount_with_breakdown?.net_amount?.value}  time=${t.time}`);
  }
}

main().catch(console.error);
