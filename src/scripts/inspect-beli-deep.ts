import { prisma } from '../models/prisma';
import { getTransactionsOfSubscription, getSubscriptionByPaypalId } from '../util/paypal';

async function main() {
  // 1) All subs in templodejeny in the last 7 days, regardless of user
  const recentOrgSubs = await prisma.subscription.findMany({
    where: {
      organizationId: 31,
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
    include: {
      user: { select: { id: true, email: true, slug: true } },
      subscriptionPlan: { select: { name: true, price: true, planId: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  console.log(`=== Subs in templodejeny (last 7 days): ${recentOrgSubs.length} ===`);
  for (const s of recentOrgSubs) {
    console.log(`  Sub #${s.id}  user=${s.user?.slug}(${s.user?.email})  plan=${s.subscriptionPlan?.name}($${s.subscriptionPlan?.price})  paypalId=${s.paypalSubscriptionId}  status=${s.status}  createdAt=${s.createdAt}`);
  }

  // 2) Any subscription anywhere by Beli in the last 7 days
  const beliSubs = await prisma.subscription.findMany({
    where: {
      userId: 7014,
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
    include: { subscriptionPlan: { select: { name: true, price: true } }, organization: { select: { slug: true } } },
    orderBy: { createdAt: 'desc' },
  });
  console.log(`\n=== Beli subs across all orgs (last 7 days): ${beliSubs.length} ===`);
  for (const s of beliSubs) {
    console.log(`  Sub #${s.id}  org=${s.organization?.slug}  plan=${s.subscriptionPlan?.name}($${s.subscriptionPlan?.price})  paypalId=${s.paypalSubscriptionId}  status=${s.status}`);
  }

  // 3) For EACH known PayPal sub, list ALL transactions (including failed/pending)
  const subIds = ['I-19PMYHJHTSBA', 'I-J3TK4EJ4VKCM'];
  for (const pid of subIds) {
    console.log(`\n=== PayPal txs for ${pid} ===`);
    try {
      const txs = await getTransactionsOfSubscription(pid);
      console.log(`  count: ${txs?.length ?? 0}`);
      for (const t of txs ?? []) {
        console.log(`  - ${t.id}  status=${t.status}  amount=${t.amount_with_breakdown?.gross_amount?.value} ${t.amount_with_breakdown?.gross_amount?.currency_code}  fee=${t.amount_with_breakdown?.fee_amount?.value}  net=${t.amount_with_breakdown?.net_amount?.value}  time=${t.time}`);
      }
    } catch (e: any) {
      console.log(`  error: ${e?.message}`);
    }
  }

  // 4) All OrganizationTransaction for templodejeny (org 31) last 7 days
  console.log(`\n=== templodejeny OrganizationTransactions (last 7 days) ===`);
  const txs = await prisma.organizationTransaction.findMany({
    where: { organizationId: 31, transactionDate: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    orderBy: { transactionDate: 'desc' },
  });
  for (const t of txs) {
    console.log(`  Tx #${t.id}  amount=${t.amount}  before=${(t as any).beforeFeesAmount ?? '-'}  txid=${t.transactionId}  subId=${t.subscriptionId}  status=${t.status}  date=${t.transactionDate}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
