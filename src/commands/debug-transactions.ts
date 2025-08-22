import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugTransactions() {
    try {
        console.log('🔍 Debugging transactions...');

        // Get current month
        const now = new Date();
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        console.log(`Current month range: ${currentMonthStart.toISOString()} to ${currentMonthEnd.toISOString()}`);

        // Get all transactions for organization 1 (assuming that's the one we're testing)
        const allTransactions = await prisma.organizationTransaction.findMany({
            where: {
                organizationId: 1,
                type: 'EARNING',
                status: 'COMPLETED'
            },
            orderBy: {
                transactionDate: 'desc'
            }
        });

        console.log(`Total transactions found: ${allTransactions.length}`);

        // Group by origin
        const byOrigin = allTransactions.reduce((acc, t) => {
            acc[t.origin] = (acc[t.origin] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        console.log('Transactions by origin:', byOrigin);

        // Show recent transactions
        console.log('\nRecent transactions:');
        allTransactions.slice(0, 10).forEach(t => {
            console.log(`ID: ${t.id}, Origin: ${t.origin}, Date: ${t.transactionDate?.toISOString()}, SubscriptionId: ${t.subscriptionId}, Amount: $${t.amount}`);
        });

        // Check this month's transactions
        const thisMonthTransactions = allTransactions.filter(t => 
            t.transactionDate && 
            t.transactionDate >= currentMonthStart && 
            t.transactionDate <= currentMonthEnd
        );

        console.log(`\nThis month's transactions: ${thisMonthTransactions.length}`);
        thisMonthTransactions.forEach(t => {
            console.log(`ID: ${t.id}, Origin: ${t.origin}, Date: ${t.transactionDate?.toISOString()}, SubscriptionId: ${t.subscriptionId}, Amount: $${t.amount}`);
        });

        // Check subscriptions
        const subscriptions = await prisma.subscription.findMany({
            where: {
                user: {
                    organizationId: 1
                },
                active: true,
                status: 'ACTIVE'
            }
        });

        console.log(`\nActive subscriptions: ${subscriptions.length}`);
        console.log('Sample subscriptions:');
        subscriptions.slice(0, 5).forEach(s => {
            console.log(`ID: ${s.id}, PayPalID: ${s.paypalSubscriptionId}, LastPayment: ${s.lastPayment?.toISOString()}`);
        });

    } catch (error) {
        console.error('❌ Error debugging transactions:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the command
debugTransactions();
