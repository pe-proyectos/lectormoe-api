// Search PayPal Reporting API for ALL transactions involving Beli's email
// in the last 7 days, so we can find the orphan -$2 charge that's in her
// PayPal but not linked to any subscription in our DB.

const environment = process.env.PAYPAL_ENV === 'live'
  ? { clientId: process.env.PAYPAL_CLIENT_ID, clientSecret: process.env.PAYPAL_CLIENT_SECRET, base: 'https://api.paypal.com' }
  : { clientId: process.env.PAYPAL_CLIENT_ID, clientSecret: process.env.PAYPAL_CLIENT_SECRET, base: 'https://api-m.sandbox.paypal.com' };

async function getAccessToken(): Promise<string> {
  const auth = btoa(`${environment.clientId}:${environment.clientSecret}`);
  const r = await fetch(`${environment.base}/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${auth}` },
    body: 'grant_type=client_credentials',
  });
  const j = await r.json();
  return j.access_token;
}

async function main() {
  const token = await getAccessToken();
  // Reporting API only allows up to 31-day windows. Pull last 7 days.
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  const url = `${environment.base}/v1/reporting/transactions?start_date=${start.toISOString()}&end_date=${end.toISOString()}&fields=all&page_size=500`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
  const data = await r.json();
  if (!r.ok) {
    console.error('Reporting API error:', JSON.stringify(data, null, 2));
    return;
  }

  const txs = data.transaction_details ?? [];
  console.log(`Total tx in window: ${txs.length}`);
  const beliTxs = txs.filter((t: any) => {
    const e = t?.payer_info?.email_address || '';
    return e.toLowerCase() === 'belichan93@gmail.com';
  });
  console.log(`\nTxs from belichan93@gmail.com: ${beliTxs.length}\n`);
  for (const t of beliTxs) {
    const ti = t.transaction_info || {};
    console.log(`  txid=${ti.transaction_id}  status=${ti.transaction_status}  amount=${ti.transaction_amount?.value} ${ti.transaction_amount?.currency_code}  fee=${ti.fee_amount?.value}  subj=${ti.transaction_subject}  initiation=${ti.transaction_initiation_date}  related=${ti.related_invoice_id ?? '-'}  paypalRef=${ti.paypal_reference_id ?? '-'}  refType=${ti.paypal_reference_id_type ?? '-'}`);
  }

  // Also: try to find every subscription for the $2 plan in the last 7 days,
  // not just the one we have in our DB.
  console.log('\n--- Looking for hidden subscriptions on plan P-91273330A8443900NNHB7Z4I ---');
  // PayPal v1 doesn't have a "list subscriptions for plan" endpoint. We can only
  // confirm via the reporting API above (paypal_reference_id_type='SUB' gives the sub id).
}

main().catch(console.error);
