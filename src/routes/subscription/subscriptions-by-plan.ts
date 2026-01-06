import { Elysia, t } from 'elysia';
import { PrismaClient } from '@prisma/client';
import { useOrganization } from '../../plugins/organization';

const prisma = new PrismaClient();

export const router = () => new Elysia()
    .use(useOrganization())
    .get(
        '/api/subscriptions-by-plan',
        async ({ organizationId }) => {
            try {
                const now = new Date();
                const currentMonth = now.getMonth();
                const currentYear = now.getFullYear();

                const monthlyData = [];

                // Get data for last 3 months
                for (let i = 2; i >= 0; i--) {
                    const targetMonth = (currentMonth - i + 12) % 12;
                    const targetYear = currentMonth - i < 0 ? currentYear - 1 : currentYear;

                    // Get subscriptions created in this month
                    const subscriptions = await prisma.subscription.findMany({
                        where: {
                            organizationId: organizationId,
                            createdAt: {
                                gte: new Date(targetYear, targetMonth, 1),
                                lt: new Date(targetYear, targetMonth + 1, 1)
                            }
                        },
                        include: {
                            subscriptionPlan: {
                                select: {
                                    id: true,
                                    name: true,
                                    price: true
                                }
                            }
                        }
                    });

                    // Group by subscription plan
                    const subscriptionsByPlan: Record<string, { count: number; planId: number; price: number }> = {};
                    
                    subscriptions.forEach(sub => {
                        const planName = sub.subscriptionPlan.name;
                        if (!subscriptionsByPlan[planName]) {
                            subscriptionsByPlan[planName] = {
                                count: 0,
                                planId: sub.subscriptionPlan.id,
                                price: sub.subscriptionPlan.price
                            };
                        }
                        subscriptionsByPlan[planName].count++;
                    });

                    // Get month name
                    const monthNames = [
                        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
                    ];

                    monthlyData.push({
                        month: monthNames[targetMonth],
                        year: targetYear,
                        totalSubscriptions: subscriptions.length,
                        subscriptionsByPlan
                    });
                }

                return { status: true, data: monthlyData };
            } catch (error) {
                console.error('Error fetching subscriptions by plan:', error);
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
                        totalSubscriptions: t.Number(),
                        subscriptionsByPlan: t.Record(t.String(), t.Object({
                            count: t.Number(),
                            planId: t.Number(),
                            price: t.Number()
                        }))
                    }))
                }),
                t.Object({
                    status: t.Literal(false),
                    error: t.String()
                })
            ])
        }
    );

