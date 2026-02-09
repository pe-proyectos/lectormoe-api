import { Elysia, t } from 'elysia';
import { prisma } from '../../models/prisma';
import { useOrganization } from '../../plugins/organization';

const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const router = () => new Elysia()
    .use(useOrganization())
    .get(
        '/api/monthly-revenue',
        async ({ organizationId }) => {
            try {
                const now = new Date();
                const currentMonth = now.getMonth();
                const currentYear = now.getFullYear();

                // Rango: ultimos 12 meses
                const startDate = new Date(currentYear, currentMonth - 11, 1);
                const endDate = new Date(currentYear, currentMonth + 1, 1);

                // Una sola consulta para todas las transacciones del ultimo año
                const transactions = await prisma.organizationTransaction.findMany({
                    where: {
                        organizationId: organizationId,
                        type: 'EARNING',
                        status: 'COMPLETED',
                        transactionDate: {
                            gte: startDate,
                            lt: endDate
                        }
                    }
                });

                // Agrupar por mes
                const monthlyMap = new Map<string, {
                    revenue: number;
                    transactionCount: number;
                    subscriptionPayments: number;
                    revenueByOrigin: Record<string, number>;
                }>();

                // Inicializar los 12 meses
                for (let i = 11; i >= 0; i--) {
                    const m = (currentMonth - i + 12) % 12;
                    const y = currentMonth - i < 0 ? currentYear - 1 : currentYear;
                    const key = `${y}-${m}`;
                    monthlyMap.set(key, {
                        revenue: 0,
                        transactionCount: 0,
                        subscriptionPayments: 0,
                        revenueByOrigin: {},
                    });
                }

                // Poblar con datos reales
                for (const tx of transactions) {
                    if (!tx.transactionDate) continue;
                    const m = tx.transactionDate.getMonth();
                    const y = tx.transactionDate.getFullYear();
                    const key = `${y}-${m}`;
                    const entry = monthlyMap.get(key);
                    if (!entry) continue;

                    entry.revenue += tx.amount;
                    entry.transactionCount++;
                    if (tx.subscriptionId) entry.subscriptionPayments++;

                    const origin = tx.origin || 'Otros';
                    entry.revenueByOrigin[origin] = (entry.revenueByOrigin[origin] || 0) + tx.amount;
                }

                // Convertir a array ordenado
                const monthlyData = [];
                for (let i = 11; i >= 0; i--) {
                    const m = (currentMonth - i + 12) % 12;
                    const y = currentMonth - i < 0 ? currentYear - 1 : currentYear;
                    const key = `${y}-${m}`;
                    const entry = monthlyMap.get(key)!;

                    monthlyData.push({
                        month: monthNames[m],
                        year: y,
                        revenue: entry.revenue,
                        transactionCount: entry.transactionCount,
                        subscriptionPayments: entry.subscriptionPayments,
                        revenueByOrigin: entry.revenueByOrigin,
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
