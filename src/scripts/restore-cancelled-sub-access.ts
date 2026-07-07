import { prisma } from "../models/prisma";
import { getSubscriptionByPaypalId } from "../util/paypal";

const USER_EMAIL = "gerardor2195@gmail.com";

const user = await prisma.user.findUnique({
  where: { email: USER_EMAIL },
  select: { id: true, email: true, username: true },
});

if (!user) {
  console.error(`Usuario no encontrado: ${USER_EMAIL}`);
  process.exit(1);
}

console.log("Usuario:", user);

const subs = await prisma.subscription.findMany({
  where: { userId: user.id },
  include: { subscriptionPlan: { select: { name: true } } },
});

console.log(`Suscripciones (${subs.length}):`);
for (const s of subs) {
  console.log(`  id=${s.id} plan=${s.subscriptionPlan?.name} active=${s.active} status=${s.status} paypalId=${s.paypalSubscriptionId} endDate=${s.endDate}`);
}

if (subs.length === 0) {
  console.error("No hay suscripciones para este usuario.");
  process.exit(1);
}

// Tomar la suscripción más reciente que tenga paypalSubscriptionId
const sub = subs.find((s) => s.paypalSubscriptionId) ?? subs[0];
console.log("\nSuscripción a restaurar:", sub.id);

let endDate: Date | null = null;

if (sub.paypalSubscriptionId) {
  const ps = await getSubscriptionByPaypalId(sub.paypalSubscriptionId);
  console.log("Estado en PayPal:", ps?.status);
  const nextBilling = ps?.billing_info?.next_billing_time;
  if (nextBilling) {
    endDate = new Date(nextBilling);
    console.log("Próximo cobro (fin del período pagado):", endDate.toISOString());
  } else {
    // Si PayPal no reporta next_billing_time (sub ya cancelada sin ciclos futuros),
    // dar 30 días desde el último pago como aproximación
    const lastPay = ps?.billing_info?.last_payment?.time;
    if (lastPay) {
      endDate = new Date(lastPay);
      endDate.setDate(endDate.getDate() + 30);
      console.log("Sin next_billing_time; estimando endDate 30 días desde último pago:", endDate.toISOString());
    } else {
      // Fallback: 30 días desde hoy
      endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);
      console.log("Sin datos de PayPal; endDate = hoy + 30 días:", endDate.toISOString());
    }
  }
}

const updated = await prisma.subscription.update({
  where: { id: sub.id },
  data: {
    active: true,
    endDate: endDate,
  },
  select: { id: true, active: true, endDate: true, status: true },
});

console.log("\nSuscripción restaurada:");
console.log(updated);

await prisma.$disconnect();
process.exit(0);
