import { prisma } from "../models/prisma";
import { getSubscriptionByPaypalId } from "../util/paypal";

// Buscar al usuario gerakun (posiblemente gerardor2195@gmail.com)
const users = await prisma.user.findMany({
  where: {
    OR: [
      { email: "gerardor2195@gmail.com" },
      { username: { contains: "gera", mode: "insensitive" } },
      { slug: { contains: "gera", mode: "insensitive" } },
    ],
  },
  select: { id: true, email: true, username: true, slug: true },
});

console.log("=== USUARIOS CANDIDATOS ===");
console.log(JSON.stringify(users, null, 2));

// Organización senshimanga
const org = await prisma.organization.findFirst({
  where: { slug: { contains: "senshi", mode: "insensitive" } },
  select: { id: true, name: true, slug: true },
});
console.log("\n=== ORGANIZACIÓN ===");
console.log(JSON.stringify(org, null, 2));

for (const u of users) {
  const subs = await prisma.subscription.findMany({
    where: { userId: u.id },
    include: {
      subscriptionPlan: { select: { id: true, name: true, organizationId: true } },
      organization: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { id: "desc" },
  });
  if (subs.length === 0) continue;
  console.log(`\n=== SUSCRIPCIONES de ${u.username} (id=${u.id}) ===`);
  for (const s of subs) {
    console.log(JSON.stringify({
      id: s.id,
      plan: s.subscriptionPlan?.name,
      org: s.organization?.slug ?? s.subscriptionPlan?.organizationId,
      status: s.status,
      active: s.active,
      startDate: s.startDate,
      endDate: s.endDate,
      lastPayment: s.lastPayment,
      nextPayment: s.nextPayment,
      updatedAt: s.updatedAt,
      paypalSubscriptionId: s.paypalSubscriptionId,
    }, null, 2));

    if (s.paypalSubscriptionId && (s.organization?.slug?.includes("senshi") || s.subscriptionPlan?.organizationId === org?.id)) {
      try {
        const ps = await getSubscriptionByPaypalId(s.paypalSubscriptionId);
        console.log(`  → PayPal status=${ps?.status} next_billing=${ps?.billing_info?.next_billing_time} last_payment=${JSON.stringify(ps?.billing_info?.last_payment)}`);
      } catch (e) {
        console.log(`  → Error consultando PayPal: ${e}`);
      }
    }
  }
}

await prisma.$disconnect();
process.exit(0);
