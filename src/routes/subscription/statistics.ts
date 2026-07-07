import { Elysia, t } from 'elysia'
import { prisma } from '../../models/prisma'
import { useOrganization } from '../../plugins/organization'

export const router = () =>
  new Elysia().use(useOrganization()).get(
    '/api/subscription-statistics',
    async ({ organizationId }) => {
      try {
        // Get current date and month start
        const now = new Date()
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const currentMonthEnd = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59,
          999
        )

        // Get all subscriptions for this organization
        const subscriptions = await prisma.subscription.findMany({
          where: {
            organizationId: organizationId
          },
          include: {
            subscriptionPlan: true
          }
        })

        // Calculate statistics.
        // A subscription is "active" if active=true AND (no endDate OR endDate in future).
        // We do NOT require status='ACTIVE' because cancelled-but-paid subs keep access.
        const activeSubscriptions = subscriptions.filter(
          (sub) => sub.active && (!sub.endDate || sub.endDate > now)
        )

        const inactiveSubscriptions = subscriptions.filter(
          (sub) => !sub.active || (sub.endDate !== null && sub.endDate <= now)
        )

        // Calculate expected revenue based on historical transaction data
        let expectedRevenue = 0

        // Get all subscription-related transactions for this organization
        const subscriptionTransactions =
          await prisma.organizationTransaction.findMany({
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
          })

        // Also check for transactions with origin 'PAYPAL' (old format)
        const paypalTransactions =
          await prisma.organizationTransaction.findMany({
            where: {
              organizationId: organizationId,
              type: 'EARNING',
              status: 'COMPLETED',
              origin: 'PAYPAL'
            }
          })

        // Combine both new and old format transactions
        const validSubscriptionTransactions = [
          ...subscriptionTransactions,
          ...paypalTransactions.filter((t) => t.subscriptionId !== null)
        ]

        // Get transactions for this month to determine who actually paid
        const thisMonthTransactions = validSubscriptionTransactions.filter(
          (transaction) =>
            transaction.transactionDate &&
            transaction.transactionDate >= currentMonthStart &&
            transaction.transactionDate <= currentMonthEnd
        )

        // Get subscription IDs that have paid this month
        const paidSubscriptionIds = new Set(
          thisMonthTransactions.map((t) => t.subscriptionId)
        )

        // Users who paid this month (based on actual transactions)
        const paidThisMonth = activeSubscriptions.filter((sub) =>
          paidSubscriptionIds.has(sub.id)
        )

        // Users who haven't paid this month but have active subscriptions
        const notPaidThisMonth = activeSubscriptions.filter(
          (sub) => !paidSubscriptionIds.has(sub.id)
        )

        // Calculate average net amount per transaction
        const totalNetAmount = validSubscriptionTransactions.reduce(
          (sum, transaction) => sum + transaction.amount,
          0
        )
        const averageNetAmount =
          validSubscriptionTransactions.length > 0
            ? totalNetAmount / validSubscriptionTransactions.length
            : 0

        // Calculate expected revenue for active subscriptions
        expectedRevenue = activeSubscriptions.reduce((total, sub) => {
          const beforeFeesAmount = sub.subscriptionPlan.price || 0

          if (averageNetAmount > 0) {
            // Use historical average if available
            return total + averageNetAmount
          }
          // Fallback to estimation if no historical data
          const paypalFee = Math.max(0.3, beforeFeesAmount * 0.029)
          const capibaraFee = beforeFeesAmount * 0.05
          const estimatedNetAmount = beforeFeesAmount - paypalFee - capibaraFee
          return total + estimatedNetAmount
        }, 0)

        // Get subscription plan distribution
        const planDistribution = await prisma.subscription.groupBy({
          by: ['subscriptionPlanId'],
          where: {
            organizationId: organizationId,
            active: true
          },
          _count: {
            id: true
          }
        })

        const planDetails = await Promise.all(
          planDistribution.map(async (plan) => {
            const planInfo = await prisma.subscriptionPlan.findUnique({
              where: { id: plan.subscriptionPlanId }
            })
            const beforeFeesAmount = planInfo?.price || 0

            // Calculate net amount per subscription
            const paypalFee = Math.max(0.3, beforeFeesAmount * 0.029)
            const capibaraFee = beforeFeesAmount * 0.05
            const netAmount = beforeFeesAmount - paypalFee - capibaraFee

            return {
              planName: planInfo?.name || 'Unknown',
              planPrice: beforeFeesAmount, // Keep original price for display
              netAmount: netAmount, // Add net amount
              subscriberCount: plan._count.id
            }
          })
        )

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
        }

        return { status: true, data: statistics }
      } catch (error) {
        console.error('Error fetching subscription statistics:', error)
        return { status: false, error: 'Internal server error' }
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
            planDistribution: t.Array(
              t.Object({
                planName: t.String(),
                planPrice: t.Number(),
                netAmount: t.Number(),
                subscriberCount: t.Number()
              })
            ),
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
  )
