import { Elysia } from "elysia";
import { cron, Patterns } from "@elysiajs/cron";
import { prisma } from "../../models/prisma";
import { getTransactionsOfSubscription } from "../../util/paypal";

async function calculateTransactions() {
  const organizations = await prisma.organization.findMany();

  for (const organization of organizations) {
    console.log(
      `- Calculating transactions for ${organization.id} organization ${organization.slug}`
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

    for (const subscription of subscriptions) {
      console.log(
        `-- Calculating transactions for ${subscription.id} subscription ${subscription.paypalSubscriptionId}`
      );
      const transactions = await getTransactionsOfSubscription(
        subscription.paypalSubscriptionId
      );
      for (const transaction of transactions) {
        console.log(
          `--- Uploading transaction ${transaction.id} ${transaction.status} ${transaction.amount_with_breakdown.net_amount.value}`
        );
        const total = parseFloat(
          transaction.amount_with_breakdown.gross_amount.value
        );
        const paypalFee = parseFloat(
          transaction.amount_with_breakdown.fee_amount.value
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
              origin: "PAYPAL",
              description: `Plan ${subscription.subscriptionPlan.name} | Subscripcion ${subscription.paypalSubscriptionId} | Status ${transaction.status} | Monto Total USD ${total} | Comision Paypal USD ${paypalFee} | Comision capibara + Comision Paypal USD ${capibaraFee} | Monto final USD ${finalAmount} | Fecha UTC ${transaction.time} | Pagado desde el email ${transaction.payer_email}`,
              beforeFeesAmount: total,
              amount: finalAmount,
              currency:
                transaction.amount_with_breakdown.net_amount.currency_code,
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
        } else {
          await prisma.organizationTransaction.create({
            data: {
              organizationId: organization.id,
              origin: "PAYPAL",
              description: `Plan ${subscription.subscriptionPlan.name} | Subscripcion ${subscription.paypalSubscriptionId} | Status ${transaction.status} | Monto Total USD ${total} | Comision Paypal USD ${paypalFee} | Comision capibara + Comision Paypal USD ${capibaraFee} | Monto final USD ${finalAmount} | Fecha UTC ${transaction.time} | Pagado desde el email ${transaction.payer_email}`,
              beforeFeesAmount: total,
              amount: finalAmount,
              currency:
                transaction.amount_with_breakdown.net_amount.currency_code,
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
        }
      }
    }
    console.log(
      `- Finished calculating transactions for ${organization.id} organization ${organization.slug}`
    );
  }
}

export const router = () =>
  new Elysia().use(
    cron({
      name: "heartbeat",
      pattern: Patterns.everyMinutes(59),
      run: calculateTransactions,
    })
  );
