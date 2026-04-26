import { prisma } from '../models/prisma';

async function main() {
  const user = await prisma.user.findUnique({
    where: { slug: 'beli' },
    select: { id: true, email: true, username: true, slug: true, createdAt: true },
  });
  console.log('User:', user);
  if (!user) return;

  const org = await prisma.organization.findUnique({
    where: { slug: 'templodejeny' },
    select: { id: true, name: true },
  });
  console.log('Org:', org);

  console.log('\n=== Subscriptions for beli ===');
  const subs = await prisma.subscription.findMany({
    where: { userId: user.id },
    include: {
      subscriptionPlan: { select: { id: true, name: true, price: true, planId: true, organizationId: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  for (const s of subs) {
    console.log(`  Sub #${s.id}  active=${s.active}  status=${s.status ?? '-'}  paypalId=${s.paypalSubscriptionId ?? '-'}`);
    console.log(`    plan: "${s.subscriptionPlan?.name}" $${s.subscriptionPlan?.price}  planPaypalId=${s.subscriptionPlan?.planId}  orgId=${s.subscriptionPlan?.organizationId}`);
    console.log(`    createdAt=${s.createdAt}  updatedAt=${s.updatedAt}  cancelledAt=${(s as any).cancelledAt ?? '-'}  endDate=${(s as any).endDate ?? '-'}`);
  }

  console.log('\n=== OrganizationTransactions linked to beli (via subs) ===');
  const subIds = subs.map(s => s.id);
  const txs = subIds.length > 0
    ? await prisma.organizationTransaction.findMany({
        where: { subscriptionId: { in: subIds } },
        orderBy: { transactionDate: 'desc' },
        take: 50,
      })
    : [];
  for (const t of txs) {
    console.log(`  Tx #${t.id}  status=${t.status}  amount=${t.amount}  type=${(t as any).type ?? '-'}  txid=${t.transactionId}`);
    console.log(`    subId=${t.subscriptionId ?? '-'}  orgId=${t.organizationId}  date=${t.transactionDate}`);
    console.log(`    metadata=${JSON.stringify(t.metadata)}`);
  }

  // Look up the manga "mi tragico isekai" within templodejeny to confirm the gating
  if (org) {
    console.log('\n=== Manga in templodejeny matching "tragico" or "isekai" ===');
    const m = await prisma.mangaCustom.findMany({
      where: { organizationId: org.id, deletedAt: null, OR: [
        { title: { contains: 'tragico', mode: 'insensitive' } },
        { title: { contains: 'isekai', mode: 'insensitive' } },
      ] },
      select: {
        id: true, title: true,
        manga: { select: { slug: true } },
        subscriptionPlansCanReadUnreleased: { select: { id: true, name: true } },
        subscriptionPlansCanReadReleased: { select: { id: true, name: true } },
      },
    });
    for (const x of m) {
      console.log(`  MC #${x.id}  "${x.title}" slug=${x.manga.slug}`);
      console.log(`    canReadUnreleased plans: ${x.subscriptionPlansCanReadUnreleased.map(p => `${p.id}(${p.name})`).join(', ') || '-'}`);
      console.log(`    canReadReleased plans:   ${x.subscriptionPlansCanReadReleased.map(p => `${p.id}(${p.name})`).join(', ') || '-'}`);
    }
  }

  console.log('\n=== EmailLog / Audit related to beli (recent) ===');
  const audits = await prisma.audit.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 15,
  });
  for (const a of audits) {
    console.log(`  Audit #${a.id}  action=${a.action}  date=${a.createdAt}  payload=${JSON.stringify(a.payload).slice(0, 200)}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
