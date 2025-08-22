import { prisma } from "../../models/prisma";
import { PaypalWebhookEvent } from "../../types/subscription/paypal_webhook";
import { getSubscriptionByPaypalId } from "../../util/paypal";

export const handlePaypalWebhook = async (webhookEvent: PaypalWebhookEvent) => {
    console.log("webhookEvent");
    console.log(webhookEvent);

    const subscription = await prisma.subscription.findFirst({
        where: {
            paypalSubscriptionId: webhookEvent.resource.id,
        },
    });

    if (!subscription) {
        throw new Error("Subscription not found");
    }

    let updateData: any = {};

    switch (webhookEvent.event_type) {
        case "PAYMENT.SALE.COMPLETED":
            updateData = { endDate: null, lastPayment: new Date() };
            
            // Create transaction record for successful payment
            try {
                const paymentAmount = parseFloat(webhookEvent.resource.amount.total);
                const paymentCurrency = webhookEvent.resource.amount.currency;
                
                // Get subscription plan details
                const subscriptionWithPlan = await prisma.subscription.findFirst({
                    where: { id: subscription.id },
                    include: {
                        subscriptionPlan: true,
                        user: {
                            include: {
                                organization: true
                            }
                        }
                    }
                });

                if (subscriptionWithPlan) {
                    // Calculate fees (PayPal typically charges 2.9% + $0.30)
                    const paypalFee = Math.max(0.30, paymentAmount * 0.029);
                    const capibaraFee = paymentAmount * 0.05; // Assuming 5% for Capibara
                    const netAmount = paymentAmount - paypalFee - capibaraFee;

                                         // Create organization transaction
                     await prisma.organizationTransaction.create({
                         data: {
                             organizationId: subscriptionWithPlan.user.organizationId,
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
                     });

                    console.log(`Created transaction for subscription ${subscription.id}: $${paymentAmount} -> $${netAmount} (net after fees)`);
                }
            } catch (error) {
                console.error('Error creating transaction record:', error);
                // Don't fail the webhook if transaction creation fails
            }
            break;
        case "BILLING.SUBSCRIPTION.CREATED":
        case "BILLING.SUBSCRIPTION.ACTIVATED":
        case "BILLING.SUBSCRIPTION.UPDATED":
            updateData = { updatedAt: new Date() };
            break;
        case "BILLING.PLAN.DEACTIVATED":
        case "BILLING.SUBSCRIPTION.EXPIRED":
        case "BILLING.SUBSCRIPTION.CANCELLED":
        case "BILLING.SUBSCRIPTION.SUSPENDED":
        case "BILLING.SUBSCRIPTION.PAYMENT.FAILED":
        case "PAYMENT.SALE.DENIED":
        case "PAYMENT.SALE.REFUNDED":
        case "PAYMENT.SALE.REVERSED":
            updateData = { endDate: new Date() };
            break;
        default:
            console.log(`Unhandled webhook event: ${webhookEvent.event_type}`);
            return true;
    }

    const paypalSubscription = await getSubscriptionByPaypalId(webhookEvent.resource.id);

    await prisma.subscription.update({
        where: {
            id: subscription.id,
        },
        data: {
            ...updateData,
            status: paypalSubscription?.status,
            active: paypalSubscription?.status === "ACTIVE",
            cycleExecutions: paypalSubscription?.billing_info.cycle_executions.reduce((acc: number, curr: any) => acc + curr.cycles_completed, 0),
            failedPaymentsCount: paypalSubscription?.billing_info.failed_payments_count,
            nextPayment: paypalSubscription?.billing_info.next_billing_time,
            lastPayment: paypalSubscription?.billing_info.last_payment.time,
            lastAmount: parseFloat(paypalSubscription?.billing_info.last_payment.amount.value),
        },
    });

    console.log(`Subscription ${subscription.id} updated with status: ${updateData.subscriptionStatus || "N/A"}`);
    return true;
};
