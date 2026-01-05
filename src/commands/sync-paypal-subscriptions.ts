import { PrismaClient } from '@prisma/client';
import { getSubscriptionByPaypalId } from '../util/paypal';

const prisma = new PrismaClient();

// Sincroniza el estado de todas las suscripciones desde PayPal
// Esto es útil como respaldo en caso de que algún webhook no llegue
async function syncSubscriptionStatuses() {
  try {
    console.log('🔄 Starting PayPal subscription status synchronization...');
    
    const organizations = await prisma.organization.findMany();

    for (const organization of organizations) {
      console.log(
        `- Syncing subscription statuses for ${organization.id} organization ${organization.slug}`
      );
      
      // Obtener todas las suscripciones de esta organización que tengan paypalSubscriptionId
      const subscriptions = await prisma.subscription.findMany({
        where: {
          subscriptionPlan: {
            organizationId: organization.id,
          },
          paypalSubscriptionId: {
            not: "",
          },
        },
        include: {
          subscriptionPlan: true,
        },
      });

      let syncedCount = 0;
      let errorCount = 0;

      for (const subscription of subscriptions) {
        try {
          console.log(
            `-- Syncing subscription ${subscription.id} (PayPal ID: ${subscription.paypalSubscriptionId})`
          );
          
          // Obtener el estado actual desde PayPal
          const paypalSubscription = await getSubscriptionByPaypalId(subscription.paypalSubscriptionId);
          
          if (!paypalSubscription) {
            console.log(`--- PayPal subscription not found for ${subscription.paypalSubscriptionId}`);
            errorCount++;
            continue;
          }

          // Actualizar el estado de la suscripción
          await prisma.subscription.update({
            where: {
              id: subscription.id,
            },
            data: {
              status: paypalSubscription?.status,
              active: paypalSubscription?.status === "ACTIVE",
              cycleExecutions: paypalSubscription?.billing_info?.cycle_executions?.reduce((acc: number, curr: any) => acc + curr.cycles_completed, 0) || 0,
              failedPaymentsCount: paypalSubscription?.billing_info?.failed_payments_count || 0,
              nextPayment: paypalSubscription?.billing_info?.next_billing_time ? new Date(paypalSubscription.billing_info.next_billing_time) : null,
              lastPayment: paypalSubscription?.billing_info?.last_payment?.time ? new Date(paypalSubscription.billing_info.last_payment.time) : null,
              lastAmount: paypalSubscription?.billing_info?.last_payment?.amount?.value ? parseFloat(paypalSubscription.billing_info.last_payment.amount.value) : null,
            },
          });

          syncedCount++;
          console.log(`--- Subscription ${subscription.id} synced: status=${paypalSubscription?.status}, active=${paypalSubscription?.status === "ACTIVE"}`);
        } catch (error) {
          console.error(`--- Error syncing subscription ${subscription.id}:`, error);
          errorCount++;
        }
      }

      console.log(
        `- Finished syncing for ${organization.id} organization ${organization.slug}: ${syncedCount} synced, ${errorCount} errors`
      );
    }

    console.log('✅ PayPal subscription status synchronization completed');
  } catch (error) {
    console.error('❌ Error during PayPal subscription status synchronization:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the command
syncSubscriptionStatuses();

