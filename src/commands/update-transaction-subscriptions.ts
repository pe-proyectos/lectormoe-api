import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateTransactionSubscriptions() {
    try {
        console.log('🔗 Updating transactions with subscription IDs...');

                 // Get all subscription transactions that don't have subscriptionId set
         const transactions = await prisma.organizationTransaction.findMany({
             where: {
                 origin: 'SUBSCRIPTION',
                 subscriptionId: null
             }
         });

        console.log(`Found ${transactions.length} subscription transactions to update`);

        let updatedCount = 0;

        for (const transaction of transactions) {
            try {
                // Try to extract subscription ID from payment details
                const paymentDetails = transaction.paymentDetails ? JSON.parse(transaction.paymentDetails) : null;
                const subscriptionId = paymentDetails?.subscriptionId;

                if (subscriptionId) {
                    // Verify the subscription exists
                    const subscription = await prisma.subscription.findUnique({
                        where: { id: parseInt(subscriptionId) }
                    });

                                         if (subscription) {
                         // Update the transaction with subscription ID
                         await prisma.organizationTransaction.update({
                             where: { id: transaction.id },
                             data: { subscriptionId: parseInt(subscriptionId) }
                         });
                         
                         updatedCount++;
                         console.log(`Updated transaction ${transaction.id} with subscription ${subscriptionId}`);
                     } else {
                         console.log(`Subscription ${subscriptionId} not found for transaction ${transaction.id}`);
                     }
                } else {
                    console.log(`No subscription ID found in payment details for transaction ${transaction.id}`);
                }
            } catch (error) {
                console.error(`Error updating transaction ${transaction.id}:`, error);
            }
        }

        console.log(`✅ Successfully updated ${updatedCount} transactions with subscription IDs`);
    } catch (error) {
        console.error('❌ Error updating transactions:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the command
updateTransactionSubscriptions();
