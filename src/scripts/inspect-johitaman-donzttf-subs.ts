import { prisma } from '../models/prisma'

for (const uid of [10870, 3293]) {
  const user = await prisma.user.findUnique({
    where: { id: uid },
    select: { id: true, username: true }
  })
  const subs = await prisma.subscription.findMany({
    where: { userId: uid },
    include: {
      subscriptionPlan: { select: { name: true, organizationId: true } },
      organization: { select: { slug: true } }
    }
  })
  console.log(`\n=== ${user?.username} (id=${uid}) — ${subs.length} suscripciones ===`)
  for (const s of subs) {
    console.log(
      `  #${s.id} org=${s.organization?.slug} plan=${s.subscriptionPlan?.name} active=${s.active} status=${s.status} endDate=${s.endDate?.toISOString()} lastPayment=${s.lastPayment?.toISOString()} paypalId=${s.paypalSubscriptionId}`
    )
  }
  // Perks vía Permission en senshimanga
  const perm = await prisma.permission.findFirst({
    where: { userId: uid, organization: { slug: 'senshimanga' } },
    select: { canDownload: true, canReadUnreleased: true, hideAds: true, role: true }
  })
  console.log(`  Permission senshimanga: ${JSON.stringify(perm)}`)
}

await prisma.$disconnect()
process.exit(0)
