import { prisma } from '../../models/prisma'
import { notifyFailedPayment } from '../../services/notify-new-chapter'
import { reconcileSubscriptionFromPaypal } from '../../services/subscription-reconcile'
import type { PaypalWebhookEvent } from '../../types/subscription/paypal_webhook'
import { getSubscriptionByPaypalId } from '../../util/paypal'
import { computePaidPeriodEnd } from '../../util/subscription-period'

export const handlePaypalWebhook = async (webhookEvent: PaypalWebhookEvent) => {
  console.log('webhookEvent')
  console.log(webhookEvent)

  let subscription = await prisma.subscription.findFirst({
    where: {
      paypalSubscriptionId: webhookEvent.resource.id
    }
  })

  // For sale events (PAYMENT.SALE.*), resource.id is the sale ID, not the
  // subscription ID. billing_agreement_id carries the actual subscription ID.
  // Try that lookup before falling through to self-heal.
  if (!subscription && webhookEvent.resource.billing_agreement_id) {
    subscription = await prisma.subscription.findFirst({
      where: {
        paypalSubscriptionId: webhookEvent.resource.billing_agreement_id
      }
    })
  }

  // Self-heal: webhook arrived for a sub our DB doesn't know about (Beli case
  // — checkout completed but client-side POST /api/subscription never landed).
  // Try to insert it from the PayPal payload before bailing.
  if (!subscription) {
    const paypalSubId =
      webhookEvent.resource.billing_agreement_id ?? webhookEvent.resource.id
    try {
      const created = await reconcileSubscriptionFromPaypal(paypalSubId)
      if (created) {
        subscription = await prisma.subscription.findUnique({
          where: { id: created.id }
        })
      }
    } catch (e) {
      console.error('[webhook] self-heal failed', e)
    }
  }

  if (!subscription) {
    throw new Error('Subscription not found')
  }

  let updateData: any = {}
  // When true, keep active=true even if PayPal status is not ACTIVE
  // (user cancelled but has paid time remaining until endDate)
  let preserveActiveUntilEndDate = false

  switch (webhookEvent.event_type) {
    case 'PAYMENT.SALE.COMPLETED':
      updateData = { endDate: null, lastPayment: new Date() }

      // Create transaction record for successful payment
      try {
        const paymentAmount = parseFloat(webhookEvent.resource.amount.total)
        const paymentCurrency = webhookEvent.resource.amount.currency

        // Get subscription plan details
        const subscriptionWithPlan = await prisma.subscription.findFirst({
          where: { id: subscription.id },
          include: {
            subscriptionPlan: {
              include: {
                organization: true
              }
            },
            user: true
          }
        })

        if (
          subscriptionWithPlan &&
          subscriptionWithPlan.subscriptionPlan.organization
        ) {
          // Capibara takes 50% of the subscription amount as total commission.
          // PayPal fees come from Capibara's cut; org always nets 50%.
          // PayPal provides the actual fee in transaction_fee when available.
          const actualPaypalFee =
            parseFloat(webhookEvent.resource?.transaction_fee?.value ?? '0') ||
            undefined
          const paypalFee =
            actualPaypalFee ?? Math.max(0.3, paymentAmount * 0.0349 + 0.3)
          const netAmount = paymentAmount * 0.5
          const capibaraFee = Math.max(0, paymentAmount * 0.5 - paypalFee)

          // Create organization transaction
          await prisma.organizationTransaction.create({
            data: {
              organizationId:
                subscriptionWithPlan.subscriptionPlan.organization.id,
              subscriptionId: subscription.id,
              origin: 'SUBSCRIPTION',
              description: `Pago de suscripción - ${subscriptionWithPlan.subscriptionPlan.name}`,
              beforeFeesAmount: paymentAmount,
              amount: netAmount,
              currency: paymentCurrency,
              type: 'EARNING',
              status: 'COMPLETED',
              paymentMethod: 'PAYPAL',
              paymentDetails: JSON.stringify(webhookEvent.resource),
              transactionId: webhookEvent.resource.id,
              paypalFee: paypalFee,
              capibaraFee: capibaraFee,
              transactionDate: new Date(webhookEvent.resource.create_time)
            }
          })

          console.log(
            `Created transaction for subscription ${subscription.id}: $${paymentAmount} -> $${netAmount} (net after fees)`
          )
        }
      } catch (error) {
        console.error('Error creating transaction record:', error)
        // Don't fail the webhook if transaction creation fails
      }
      break
    case 'BILLING.SUBSCRIPTION.CREATED':
    case 'BILLING.SUBSCRIPTION.ACTIVATED':
    case 'BILLING.SUBSCRIPTION.UPDATED':
      updateData = { updatedAt: new Date() }
      break
    case 'BILLING.SUBSCRIPTION.CANCELLED':
    case 'BILLING.SUBSCRIPTION.SUSPENDED': {
      // User already paid for the current period — keep access until it ends.
      // PayPal clears next_billing_time on cancellation, so fall back to
      // lastPayment + plan interval (our DB keeps lastPayment reliably).
      const paypalSubForEnd = await getSubscriptionByPaypalId(
        webhookEvent.resource.id
      )
      const plan = await prisma.subscriptionPlan.findUnique({
        where: { id: subscription.subscriptionPlanId },
        select: { interval: true }
      })
      const periodEnd = computePaidPeriodEnd({
        nextBillingTime: paypalSubForEnd?.billing_info?.next_billing_time,
        lastPaymentTime:
          paypalSubForEnd?.billing_info?.last_payment?.time ??
          subscription.lastPayment,
        interval: plan?.interval
      })
      updateData = { endDate: periodEnd }
      // Keep the user's access active until the period expires
      preserveActiveUntilEndDate = periodEnd > new Date()
      break
    }
    case 'BILLING.PLAN.DEACTIVATED':
    case 'BILLING.SUBSCRIPTION.EXPIRED':
      updateData = { endDate: new Date() }
      break
    case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
    case 'PAYMENT.SALE.DENIED':
      updateData = { endDate: new Date() }
      // Notify org staff (fire-and-forget). Email dispatched 30 min later
      // by the notification cron if still unread.
      if (subscription.organizationId) {
        notifyFailedPayment(subscription.id).catch(console.error)
      }
      break
    case 'PAYMENT.SALE.REFUNDED':
    case 'PAYMENT.SALE.REVERSED':
      updateData = { endDate: new Date() }
      break
    default:
      console.log(`Unhandled webhook event: ${webhookEvent.event_type}`)
      return true
  }

  // For sale events resource.id is the sale ID; use the resolved subscription ID.
  const paypalSubscription = await getSubscriptionByPaypalId(
    subscription.paypalSubscriptionId ?? webhookEvent.resource.id
  )
  const billing = paypalSubscription?.billing_info ?? {}

  await prisma.subscription.update({
    where: {
      id: subscription.id
    },
    data: {
      ...updateData,
      status: paypalSubscription?.status,
      // If user cancelled but still has paid time left, keep active until cron
      // flips it after endDate passes. Otherwise derive from PayPal status.
      active: preserveActiveUntilEndDate
        ? true
        : paypalSubscription?.status === 'ACTIVE',
      cycleExecutions: (billing.cycle_executions ?? []).reduce(
        (acc: number, curr: any) => acc + curr.cycles_completed,
        0
      ),
      failedPaymentsCount: billing.failed_payments_count,
      nextPayment: billing.next_billing_time
        ? new Date(billing.next_billing_time)
        : null,
      lastPayment: billing.last_payment?.time
        ? new Date(billing.last_payment.time)
        : undefined,
      lastAmount: billing.last_payment?.amount?.value
        ? parseFloat(billing.last_payment.amount.value)
        : undefined
    }
  })

  console.log(
    `Subscription ${subscription.id} updated with status: ${updateData.subscriptionStatus || 'N/A'}`
  )
  return true
}
