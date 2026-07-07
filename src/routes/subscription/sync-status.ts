import { cron, Patterns } from '@elysiajs/cron'
import { Elysia } from 'elysia'
import { prisma } from '../../models/prisma'
import { wrapCron } from '../../util/cron-alert'
import { getSubscriptionByPaypalId } from '../../util/paypal'
import { computePaidPeriodEnd } from '../../util/subscription-period'

// Sincroniza el estado de todas las suscripciones desde PayPal
// Esto es útil como respaldo en caso de que algún webhook no llegue
async function syncSubscriptionStatuses() {
  const startTime = new Date()
  console.log(
    `🔄 [CRON] Starting subscription status sync at ${startTime.toISOString()}`
  )

  try {
    const organizations = await prisma.organization.findMany()
    console.log(`📋 Found ${organizations.length} organizations to sync`)

    let totalSynced = 0
    let totalErrors = 0
    const totalSkipped = 0

    for (const organization of organizations) {
      console.log(
        `\n🏢 Syncing subscriptions for organization: ${organization.slug} (ID: ${organization.id})`
      )

      // Obtener todas las suscripciones de esta organización que tengan paypalSubscriptionId
      const subscriptions = await prisma.subscription.findMany({
        where: {
          subscriptionPlan: {
            organizationId: organization.id
          }
        },
        include: {
          subscriptionPlan: true
        }
      })

      console.log(
        `   Found ${subscriptions.length} subscriptions with PayPal ID`
      )

      let syncedCount = 0
      let errorCount = 0
      let skippedCount = 0

      for (const subscription of subscriptions) {
        try {
          if (!subscription.paypalSubscriptionId) {
            skippedCount++
            continue
          }

          // Obtener el estado actual desde PayPal
          const paypalSubscription = await getSubscriptionByPaypalId(
            subscription.paypalSubscriptionId
          )

          if (!paypalSubscription) {
            console.log(
              `   ⚠️  PayPal subscription not found: ${subscription.paypalSubscriptionId}`
            )
            errorCount++
            totalErrors++
            continue
          }

          // Calcular cycles_completed
          const cyclesCompleted =
            paypalSubscription?.billing_info?.cycle_executions?.reduce(
              (acc: number, curr: any) => acc + (curr.cycles_completed || 0),
              0
            ) || 0

          // Actualizar el estado de la suscripción.
          // Si el status de PayPal no es ACTIVE (ej: CANCELLED) pero el usuario tiene
          // un endDate en el futuro (período de gracia ya pagado), mantenemos active=true.
          // Si el webhook de cancelación se perdió y endDate quedó null, lo derivamos
          // del último pago + intervalo del plan.
          const paypalActive = paypalSubscription?.status === 'ACTIVE'
          const now = new Date()
          let subEndDate = subscription.endDate
          if (!paypalActive && subEndDate === null) {
            subEndDate = computePaidPeriodEnd({
              nextBillingTime:
                paypalSubscription?.billing_info?.next_billing_time,
              lastPaymentTime:
                paypalSubscription?.billing_info?.last_payment?.time ??
                subscription.lastPayment,
              interval: subscription.subscriptionPlan?.interval
            })
          }
          const inGracePeriod =
            !paypalActive && subEndDate !== null && subEndDate > now
          const wantActive = paypalActive || inGracePeriod

          await prisma.subscription.update({
            where: {
              id: subscription.id
            },
            data: {
              status: paypalSubscription?.status || subscription.status,
              active: wantActive,
              // Para subs ACTIVE limpiamos endDate residual de una cancelación previa
              // (el usuario reactivó); para canceladas persistimos el fin del período pagado.
              endDate: paypalActive ? null : subEndDate,
              cycleExecutions: cyclesCompleted,
              failedPaymentsCount:
                paypalSubscription?.billing_info?.failed_payments_count || 0,
              nextPayment: paypalSubscription?.billing_info?.next_billing_time
                ? new Date(paypalSubscription.billing_info.next_billing_time)
                : null,
              lastPayment: paypalSubscription?.billing_info?.last_payment?.time
                ? new Date(paypalSubscription.billing_info.last_payment.time)
                : null,
              lastAmount: paypalSubscription?.billing_info?.last_payment?.amount
                ?.value
                ? parseFloat(
                    paypalSubscription.billing_info.last_payment.amount.value
                  )
                : null
            }
          })

          syncedCount++
          totalSynced++

          // Log solo si el estado cambió
          if (subscription.status !== paypalSubscription?.status) {
            console.log(
              `   ✅ Subscription ${subscription.id} updated: ${subscription.status} → ${paypalSubscription?.status}`
            )
          }
        } catch (error) {
          console.error(
            `   ❌ Error syncing subscription ${subscription.id}:`,
            error
          )
          errorCount++
          totalErrors++
        }
      }

      console.log(
        `   📊 Organization ${organization.slug}: ${syncedCount} synced, ${errorCount} errors, ${skippedCount} skipped`
      )
    }

    const endTime = new Date()
    const duration = Math.round(
      (endTime.getTime() - startTime.getTime()) / 1000
    )

    console.log(`\n✅ [CRON] Subscription sync completed in ${duration}s`)
    console.log(
      `   📈 Total: ${totalSynced} synced, ${totalErrors} errors, ${totalSkipped} skipped`
    )
  } catch (error) {
    console.error(`❌ [CRON] Fatal error in subscription sync:`, error)
    throw error
  }
}

export const router = () =>
  new Elysia().use(
    cron({
      name: 'sync-subscription-statuses',
      pattern: Patterns.everyHours(3), // Sincronizar cada 3 horas como respaldo de los webhooks
      run: wrapCron('sync-subscription-statuses', syncSubscriptionStatuses)
    })
  )
