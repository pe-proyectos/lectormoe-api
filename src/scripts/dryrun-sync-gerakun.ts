// Dry-run: aplica la lógica del sync cron (nueva) a la sub #113 sin escribir en DB.
import { prisma } from '../models/prisma'
import { getSubscriptionByPaypalId } from '../util/paypal'
import { computePaidPeriodEnd } from '../util/subscription-period'

const subscription = await prisma.subscription.findUnique({
  where: { id: 113 },
  include: { subscriptionPlan: true }
})
if (!subscription) throw new Error('sub 113 no encontrada')

const paypalSubscription = await getSubscriptionByPaypalId(subscription.paypalSubscriptionId)
const paypalActive = paypalSubscription?.status === 'ACTIVE'
const now = new Date()
let subEndDate = subscription.endDate
if (!paypalActive && subEndDate === null) {
  subEndDate = computePaidPeriodEnd({
    nextBillingTime: paypalSubscription?.billing_info?.next_billing_time,
    lastPaymentTime: paypalSubscription?.billing_info?.last_payment?.time ?? subscription.lastPayment,
    interval: subscription.subscriptionPlan?.interval
  })
}
const inGracePeriod = !paypalActive && subEndDate !== null && subEndDate > now
const wantActive = paypalActive || inGracePeriod

console.log({
  dbActive: subscription.active,
  dbEndDate: subscription.endDate,
  paypalStatus: paypalSubscription?.status,
  derivedEndDate: subEndDate,
  inGracePeriod,
  wantActive
})
console.log(wantActive ? '✅ El cron mantendrá active=true (acceso conservado)' : '❌ El cron lo desactivaría')

await prisma.$disconnect()
process.exit(0)
