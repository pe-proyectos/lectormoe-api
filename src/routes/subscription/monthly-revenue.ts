import { Elysia, t } from 'elysia';
import { prisma } from '../../models/prisma';
import { useOrganization } from '../../plugins/organization';

export const router = () => new Elysia()
    .use(useOrganization())
    .get(
        '/api/monthly-revenue',
        async ({ organizationId }) => {
            try {
                const now = new Date();
                const currentMonth = now.getMonth(); // 0-11
                const currentYear = now.getFullYear();

                const monthlyData = [];

                // Get data for last 3 months
                for (let i = 2; i >= 0; i--) {
                    const targetMonth = (currentMonth - i + 12) % 12;
                    const targetYear = currentMonth - i < 0 ? currentYear - 1 : currentYear;

                    // Get transactions for this month
                    const transactions = await prisma.organizationTransaction.findMany({
                        where: {
                            organizationId: organizationId,
                            type: 'EARNING',
                            status: 'COMPLETED',
                            transactionDate: {
                                gte: new Date(targetYear, targetMonth, 1),
                                lt: new Date(targetYear, targetMonth + 1, 1)
                            }
                        }
                    });

                    // Group transactions by origin and calculate revenue
                    const revenueByOrigin: Record<string, number> = {};
                    transactions.forEach(transaction => {
                        const origin = transaction.origin || 'Otros';
                        revenueByOrigin[origin] = (revenueByOrigin[origin] || 0) + transaction.amount;
                    });

                    // Get subscription payments for this month (transactions linked to subscriptions)
                    const subscriptionPayments = await prisma.organizationTransaction.findMany({
                        where: {
                            organizationId: organizationId,
                            type: 'EARNING',
                            status: 'COMPLETED',
                            subscriptionId: {
                                not: null
                            },
                            transactionDate: {
                                gte: new Date(targetYear, targetMonth, 1),
                                lt: new Date(targetYear, targetMonth + 1, 1)
                            }
                        }
                    });

                    // Calculate total revenue for this month
                    const totalRevenue = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);

                    // Get month name
                    const monthNames = [
                        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
                    ];

                    monthlyData.push({
                        month: monthNames[targetMonth],
                        year: targetYear,
                        revenue: totalRevenue,
                        transactionCount: transactions.length,
                        subscriptionPayments: subscriptionPayments.length,
                        revenueByOrigin
                    });
                }

                return { status: true, data: monthlyData };
            } catch (error) {
                console.error('Error fetching monthly revenue:', error);
                return { status: false, error: 'Internal server error' };
            }
        },
        {
            response: t.Union([
                t.Object({
                    status: t.Literal(true),
                    data: t.Array(t.Object({
                        month: t.String(),
                        year: t.Number(),
                        revenue: t.Number(),
                        transactionCount: t.Number(),
                        subscriptionPayments: t.Number(),
                        revenueByOrigin: t.Record(t.String(), t.Number())
                    }))
                }),
                t.Object({
                    status: t.Literal(false),
                    error: t.String()
                })
            ])
        }
    );
