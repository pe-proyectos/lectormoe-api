import { Elysia } from "elysia";
import { cron, Patterns } from "@elysiajs/cron";
import { prisma } from "../../models/prisma";
import { getTransactionsOfSubscription } from "../../util/paypal";
calculateTransactions()
async function calculateTransactions() {
  try {
    console.log('🔄 Iniciando sincronización de transacciones de suscripciones...');
    const organizations = await prisma.organization.findMany();

    let totalTransactionsCreated = 0;
    let totalTransactionsUpdated = 0;
    let totalErrors = 0;

    for (const organization of organizations) {
      try {
        console.log(
          `- Calculando transacciones para organización ${organization.id} (${organization.slug})`
        );
        const subscriptions = await prisma.subscription.findMany({
          where: {
            subscriptionPlan: {
              organizationId: organization.id,
            },
            active: true,
          },
          include: {
            subscriptionPlan: true,
          },
        });

        if (subscriptions.length === 0) {
          console.log(`  No hay suscripciones activas para la organización ${organization.slug}`);
          continue;
        }

        for (const subscription of subscriptions) {
          try {
            if (!subscription.paypalSubscriptionId) {
              console.log(`  ⚠️ Suscripción ${subscription.id} no tiene paypalSubscriptionId, saltando...`);
              continue;
            }

            console.log(
              `  -- Calculando transacciones para suscripción ${subscription.id} (PayPal ID: ${subscription.paypalSubscriptionId})`
            );
            
            const transactions = await getTransactionsOfSubscription(
              subscription.paypalSubscriptionId
            );

            if (!Array.isArray(transactions) || transactions.length === 0) {
              console.log(`    No se encontraron transacciones para la suscripción ${subscription.id}`);
              continue;
            }

            for (const transaction of transactions) {
              try {
                if (!transaction.id) {
                  console.log(`    ⚠️ Transacción sin ID, saltando...`);
                  continue;
                }

                console.log(
                  `    --- Procesando transacción ${transaction.id} (${transaction.status}) - ${transaction.amount_with_breakdown?.net_amount?.value || 'N/A'}`
                );

                const total = parseFloat(
                  transaction.amount_with_breakdown?.gross_amount?.value || '0'
                );
                const paypalFee = parseFloat(
                  transaction.amount_with_breakdown?.fee_amount?.value || '0'
                );
                const capibaraFee = Math.max(0, total * 0.5 - paypalFee);
                const finalAmount = total - capibaraFee - paypalFee;

                const transactionExists =
                  await prisma.organizationTransaction.findFirst({
                    where: {
                      transactionId: transaction.id,
                    },
                  });

                if (transactionExists) {
                  await prisma.organizationTransaction.update({
                    where: {
                      id: transactionExists.id,
                    },
                    data: {
                      organizationId: organization.id,
                      subscriptionId: subscription.id,
                      origin: "SUBSCRIPTION",
                      description: `Pago de suscripción - ${subscription.subscriptionPlan.name}`,
                      beforeFeesAmount: total,
                      amount: finalAmount,
                      currency:
                        transaction.amount_with_breakdown?.net_amount?.currency_code || 'USD',
                      type: "EARNING",
                      status: transaction.status,
                      paymentMethod: "PAYPAL",
                      paymentDetails: JSON.stringify(transaction),
                      transactionId: transaction.id,
                      capibaraFee: capibaraFee,
                      paypalFee: paypalFee,
                      transactionDate: new Date(transaction.time),
                    },
                  });
                  totalTransactionsUpdated++;
                  console.log(`    ✅ Transacción ${transaction.id} actualizada`);
                } else {
                  await prisma.organizationTransaction.create({
                    data: {
                      organizationId: organization.id,
                      subscriptionId: subscription.id,
                      origin: "SUBSCRIPTION",
                      description: `Pago de suscripción - ${subscription.subscriptionPlan.name}`,
                      beforeFeesAmount: total,
                      amount: finalAmount,
                      currency:
                        transaction.amount_with_breakdown?.net_amount?.currency_code || 'USD',
                      type: "EARNING",
                      status: transaction.status,
                      paymentMethod: "PAYPAL",
                      paymentDetails: JSON.stringify(transaction),
                      transactionId: transaction.id,
                      capibaraFee: capibaraFee,
                      paypalFee: paypalFee,
                      transactionDate: new Date(transaction.time),
                    },
                  });
                  totalTransactionsCreated++;
                  console.log(`    ✅ Transacción ${transaction.id} creada y vinculada a suscripción ${subscription.id}`);
                }
              } catch (error: any) {
                totalErrors++;
                console.error(`    ❌ Error procesando transacción ${transaction?.id || 'unknown'}:`, error?.message || error);
              }
            }
          } catch (error: any) {
            totalErrors++;
            console.error(`  ❌ Error procesando suscripción ${subscription?.id || 'unknown'}:`, error?.message || error);
          }
        }
        console.log(
          `- Finalizado cálculo de transacciones para organización ${organization.id} (${organization.slug})`
        );
      } catch (error: any) {
        totalErrors++;
        console.error(`❌ Error procesando organización ${organization?.id || 'unknown'}:`, error?.message || error);
      }
    }

    console.log(`✅ Sincronización completada:`);
    console.log(`   - Transacciones creadas: ${totalTransactionsCreated}`);
    console.log(`   - Transacciones actualizadas: ${totalTransactionsUpdated}`);
    console.log(`   - Errores: ${totalErrors}`);
  } catch (error: any) {
    console.error('❌ Error crítico en calculateTransactions:', error?.message || error);
  }
}

// Cron activado - sincroniza transacciones de PayPal periódicamente
// Los webhooks de PayPal son la fuente principal, pero este cron asegura que no se pierdan transacciones
export const router = () =>
  new Elysia().use(
    cron({
      name: "sync-subscription-transactions",
      pattern: Patterns.everyHours(6), // Ejecutar cada 6 horas
      run: calculateTransactions,
    })
  );
