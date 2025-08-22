import { Elysia, t } from 'elysia';
import { PrismaClient } from '@prisma/client';
import { useOrganization } from '../../plugins/organization';

const prisma = new PrismaClient();

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
                        subscriptionPayments: subscriptionPayments.length
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
                        subscriptionPayments: t.Number()
                    }))
                }),
                t.Object({
                    status: t.Literal(false),
                    error: t.String()
                })
            ])
        }
    );
