import { getSubscriptionByPaypalId, getTransactionsOfSubscription } from '../util/paypal';

const SUBS = [
  { id: 88, plan: 'Fieles $1', paypalId: 'I-19PMYHJHTSBA' },
  { id: 89, plan: 'Acólitos $2', paypalId: 'I-J3TK4EJ4VKCM' },
];

async function main() {
  for (const s of SUBS) {
    console.log(`\n=== Sub #${s.id} (${s.plan}) ${s.paypalId} ===`);
    try {
      const ps = await getSubscriptionByPaypalId(s.paypalId);
      if (!ps) { console.log('  PayPal returned null/404'); continue; }
      console.log(`  status: ${ps.status}  reason: ${ps.status_change_note ?? '-'}`);
      console.log(`  start: ${ps.start_time}  update: ${ps.update_time}`);
      const bi = ps.billing_info;
      if (bi) {
        console.log(`  failedPayments: ${bi.failed_payments_count}  outstanding: ${bi.outstanding_balance?.value} ${bi.outstanding_balance?.currency_code}`);
        console.log(`  lastPayment: ${bi.last_payment ? `${bi.last_payment.amount?.value} ${bi.last_payment.amount?.currency_code} @ ${bi.last_payment.time}` : 'none'}`);
        console.log(`  nextPayment: ${bi.next_billing_time ?? '-'}`);
        const cycles = bi.cycle_executions ?? [];
        for (const c of cycles) console.log(`    cycle pricing=${c.tenure_type} cyclesCompleted=${c.cycles_completed} totalCycles=${c.total_cycles}`);
      }
      try {
        const txs = await getTransactionsOfSubscription(s.paypalId);
        console.log(`  PayPal transactions for this sub: ${txs?.length ?? 0}`);
        for (const t of txs ?? []) {
          console.log(`    - ${t.id ?? t.transaction_id ?? '?'}  status=${t.status}  amount=${t.amount_with_breakdown?.gross_amount?.value} ${t.amount_with_breakdown?.gross_amount?.currency_code}  time=${t.time}`);
        }
      } catch (e: any) {
        console.log(`  tx fetch error: ${e?.message}`);
      }
    } catch (e: any) {
      console.log(`  error: ${e?.message}`);
    }
  }
}

main().catch(console.error);
