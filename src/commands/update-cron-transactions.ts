import { prisma } from '../models/prisma';

async function updateCronTransactions() {
    try {
        console.log('🔗 Updating cron transactions with subscription IDs...');

        // Get all transactions created by cron that don't have subscriptionId set
        const transactions = await prisma.organizationTransaction.findMany({
            where: {
                origin: 'PAYPAL', // Old cron transactions
                subscriptionId: null,
                description: {
                    contains: 'Subscripcion'
                }
            }
        });

        console.log(`Found ${transactions.length} cron transactions to update`);

        let updatedCount = 0;

        for (const transaction of transactions) {
            try {
                // Extract subscription ID from description
                // Format: "Plan X | Subscripcion SUBSCRIPTION_ID | Status ..."
                const descriptionMatch = transaction.description?.match(/Subscripcion ([A-Z0-9_-]+)/);
                
                if (descriptionMatch) {
                    const paypalSubscriptionId = descriptionMatch[1];
                    
                    // Find subscription by PayPal subscription ID
                    const subscription = await prisma.subscription.findFirst({
                        where: {
                            paypalSubscriptionId: paypalSubscriptionId
                        },
                        include: {
                            subscriptionPlan: true
                        }
                    });

                    if (subscription) {
                        // Update the transaction
                        await prisma.organizationTransaction.update({
                            where: { id: transaction.id },
                            data: {
                                subscriptionId: subscription.id,
                                origin: 'SUBSCRIPTION',
                                description: `Pago de suscripción - ${subscription.subscriptionPlan?.name || 'Unknown Plan'}`
                            }
                        });
                        
                        updatedCount++;
                        console.log(`Updated transaction ${transaction.id} with subscription ${subscription.id} (PayPal ID: ${paypalSubscriptionId})`);
                    } else {
                        console.log(`Subscription with PayPal ID ${paypalSubscriptionId} not found for transaction ${transaction.id}`);
                    }
                } else {
                    console.log(`No subscription ID found in description for transaction ${transaction.id}`);
                }
            } catch (error) {
                console.error(`Error updating transaction ${transaction.id}:`, error);
            }
        }

        console.log(`✅ Successfully updated ${updatedCount} cron transactions with subscription IDs`);
    } catch (error) {
        console.error('❌ Error updating cron transactions:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the command
updateCronTransactions();
