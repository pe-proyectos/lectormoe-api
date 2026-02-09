import { Elysia, t } from 'elysia';
import { prisma } from '../../models/prisma';
import { useOrganization } from '../../plugins/organization';

export const router = () => new Elysia()
    .use(useOrganization())
    .get(
        '/api/subscription-statistics',
        async ({ organizationId }) => {
            try {
                // Get current date and month start
                const now = new Date();
                const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

                // Get all subscriptions for this organization
                const subscriptions = await prisma.subscription.findMany({
                    where: {
                        organizationId: organizationId
                    },
                    include: {
                        subscriptionPlan: true,
                        user: true
                    }
                });

                // Calculate statistics
                const activeSubscriptions = subscriptions.filter(sub => 
                    sub.active && sub.status === 'ACTIVE' && 
                    (!sub.endDate || sub.endDate > now)
                );

                const inactiveSubscriptions = subscriptions.filter(sub => 
                    !sub.active || sub.status !== 'ACTIVE' || 
                    (sub.endDate && sub.endDate <= now)
                );

                // Debug: Find subscriptions that are active but not counted in activeSubscriptions
                const onlyActiveTrue = subscriptions.filter(sub => sub.active);
                const excludedSubscriptions = onlyActiveTrue.filter(sub => 
                    !activeSubscriptions.includes(sub)
                );

                console.log(`Total subscriptions: ${subscriptions.length}`);
                console.log(`Only active: true: ${onlyActiveTrue.length}`);
                console.log(`Active with strict criteria: ${activeSubscriptions.length}`);
                console.log(`Excluded subscriptions: ${excludedSubscriptions.length}`);
                
                if (excludedSubscriptions.length > 0) {
                    console.log('Excluded subscription details:');
                    excludedSubscriptions.forEach(sub => {
                        console.log(`ID: ${sub.id}, Active: ${sub.active}, Status: ${sub.status}, EndDate: ${sub.endDate}, User: ${sub.user.username}`);
                    });
                }

                // Calculate expected revenue based on historical transaction data
                let expectedRevenue = 0;
                
                // Get all subscription-related transactions for this organization
                const subscriptionTransactions = await prisma.organizationTransaction.findMany({
                    where: {
                        organizationId: organizationId,
                        type: 'EARNING',
                        status: 'COMPLETED',
                        origin: 'SUBSCRIPTION',
                        subscriptionId: {
                            not: null
                        }
                    },
                    include: {
                        subscription: {
                            include: {
                                subscriptionPlan: true
                            }
                        }
                    }
                });

                console.log(`Raw subscription transactions found: ${subscriptionTransactions.length}`);
                
                // Also check for transactions with origin 'PAYPAL' (old format)
                const paypalTransactions = await prisma.organizationTransaction.findMany({
                    where: {
                        organizationId: organizationId,
                        type: 'EARNING',
                        status: 'COMPLETED',
                        origin: 'PAYPAL'
                    }
                });
                
                console.log(`PayPal transactions found: ${paypalTransactions.length}`);
                console.log(`Sample transaction dates:`, paypalTransactions.slice(0, 3).map(t => ({
                    id: t.id,
                    date: t.transactionDate,
                    origin: t.origin,
                    subscriptionId: t.subscriptionId
                })));

                // Combine both new and old format transactions
                const validSubscriptionTransactions = [
                    ...subscriptionTransactions,
                    ...paypalTransactions.filter(t => t.subscriptionId !== null)
                ];
                
                console.log(`Total valid transactions: ${validSubscriptionTransactions.length}`);

                // Get transactions for this month to determine who actually paid
                const thisMonthTransactions = validSubscriptionTransactions.filter(transaction => 
                    transaction.transactionDate && 
                    transaction.transactionDate >= currentMonthStart && 
                    transaction.transactionDate <= currentMonthEnd
                );

                console.log(`Found ${thisMonthTransactions.length} transactions this month`);
                console.log(`Current month range: ${currentMonthStart.toISOString()} to ${currentMonthEnd.toISOString()}`);
                console.log(`Sample transaction dates:`, validSubscriptionTransactions.slice(0, 5).map(t => ({
                    id: t.id,
                    date: t.transactionDate?.toISOString(),
                    subscriptionId: t.subscriptionId
                })));

                // Get subscription IDs that have paid this month
                const paidSubscriptionIds = new Set(thisMonthTransactions.map(t => t.subscriptionId));

                // Users who paid this month (based on actual transactions)
                const paidThisMonth = activeSubscriptions.filter(sub => 
                    paidSubscriptionIds.has(sub.id)
                );

                // Users who haven't paid this month but have active subscriptions
                const notPaidThisMonth = activeSubscriptions.filter(sub => 
                    !paidSubscriptionIds.has(sub.id)
                );

                console.log(`Active subscriptions: ${activeSubscriptions.length}`);
                console.log(`Paid this month: ${paidThisMonth.length}`);
                console.log(`Not paid this month: ${notPaidThisMonth.length}`);
                console.log(`Paid subscription IDs:`, Array.from(paidSubscriptionIds));

                // Calculate average net amount per transaction
                const totalNetAmount = validSubscriptionTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
                const averageNetAmount = validSubscriptionTransactions.length > 0 ? totalNetAmount / validSubscriptionTransactions.length : 0;

                console.log(`Found ${validSubscriptionTransactions.length} valid subscription transactions with average net amount: $${averageNetAmount.toFixed(2)}`);

                // Calculate expected revenue for active subscriptions
                expectedRevenue = activeSubscriptions.reduce((total, sub) => {
                    const beforeFeesAmount = sub.subscriptionPlan.price || 0;
                    
                    if (averageNetAmount > 0) {
                        // Use historical average if available
                        console.log(`Subscription ${sub.id}: Plan ${sub.subscriptionPlan.name} - Historical average net: $${averageNetAmount.toFixed(2)}`);
                        return total + averageNetAmount;
                    } else {
                        // Fallback to estimation if no historical data
                        const paypalFee = Math.max(0.30, beforeFeesAmount * 0.029);
                        const capibaraFee = beforeFeesAmount * 0.05;
                        const estimatedNetAmount = beforeFeesAmount - paypalFee - capibaraFee;
                        
                        console.log(`Subscription ${sub.id}: Plan ${sub.subscriptionPlan.name} - No historical data, estimated net: $${estimatedNetAmount.toFixed(2)}`);
                        return total + estimatedNetAmount;
                    }
                }, 0);
                
                console.log('Total expected revenue (based on historical data):', expectedRevenue);

                // Get subscription plan distribution
                const planDistribution = await prisma.subscription.groupBy({
                    by: ['subscriptionPlanId'],
                    where: {
                        organizationId: organizationId,
                        active: true,
                        status: 'ACTIVE'
                    },
                    _count: {
                        id: true
                    }
                });

                const planDetails = await Promise.all(
                    planDistribution.map(async (plan) => {
                        const planInfo = await prisma.subscriptionPlan.findUnique({
                            where: { id: plan.subscriptionPlanId }
                        });
                        const beforeFeesAmount = planInfo?.price || 0;
                        
                        // Calculate net amount per subscription
                        const paypalFee = Math.max(0.30, beforeFeesAmount * 0.029);
                        const capibaraFee = beforeFeesAmount * 0.05;
                        const netAmount = beforeFeesAmount - paypalFee - capibaraFee;
                        
                        const planDetail = {
                            planName: planInfo?.name || 'Unknown',
                            planPrice: beforeFeesAmount, // Keep original price for display
                            netAmount: netAmount, // Add net amount
                            subscriberCount: plan._count.id
                        };
                        console.log(`Plan: ${planDetail.planName} - Before fees: $${planDetail.planPrice} - Net per sub: $${planDetail.netAmount.toFixed(2)} - Count: ${planDetail.subscriberCount} - Total net: $${(planDetail.netAmount * planDetail.subscriberCount).toFixed(2)}`);
                        return planDetail;
                    })
                );

                const statistics = {
                    activeSubscriptions: activeSubscriptions.length,
                    inactiveSubscriptions: inactiveSubscriptions.length,
                    paidThisMonth: paidThisMonth.length,
                    notPaidThisMonth: notPaidThisMonth.length,
                    expectedRevenue,
                    totalSubscriptions: subscriptions.length,
                    planDistribution: planDetails,
                    currentMonth: {
                        start: currentMonthStart,
                        end: currentMonthEnd
                    }
                };

                return { status: true, data: statistics };
                         } catch (error) {
                 console.error('Error fetching subscription statistics:', error);
                 return { status: false, error: 'Internal server error' };
             }
        },
                 {
             response: t.Union([
                 t.Object({
                     status: t.Literal(true),
                     data: t.Object({
                         activeSubscriptions: t.Number(),
                         inactiveSubscriptions: t.Number(),
                         paidThisMonth: t.Number(),
                         notPaidThisMonth: t.Number(),
                         expectedRevenue: t.Number(),
                         totalSubscriptions: t.Number(),
                         planDistribution: t.Array(t.Object({
                             planName: t.String(),
                             planPrice: t.Number(),
                             netAmount: t.Number(),
                             subscriberCount: t.Number()
                         })),
                         currentMonth: t.Object({
                             start: t.Date(),
                             end: t.Date()
                         })
                     })
                 }),
                 t.Object({
                     status: t.Literal(false),
                     error: t.String()
                 })
             ])
         }
    );
