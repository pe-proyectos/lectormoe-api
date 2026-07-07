import { Elysia, t } from 'elysia'
import { getOwnSubscriptionById } from '../../controllers/subscription/me'
import { prisma } from '../../models/prisma'
import { loggedUserOnlyGlobal } from '../../plugins/auth'
import {
  cancelSubscriptionByPaypalId,
  getSubscriptionByPaypalId
} from '../../util/paypal'
import { computePaidPeriodEnd } from '../../util/subscription-period'

export const router = () =>
  new Elysia().use(loggedUserOnlyGlobal()).delete(
    '/api/subscription/me/:id/cancel',
    async ({ user, params, set }) => {
      const id = Number.parseInt(params.id)
      if (Number.isNaN(id)) throw new Error('Id de suscripción inválido.')

      const sub = await getOwnSubscriptionById(user.id, id)
      if (!sub) {
        set.status = 404
        throw new Error('Suscripción no encontrada.')
      }

      const status = (sub.status ?? '').toUpperCase()
      if (status === 'CANCELLED' || status === 'EXPIRED') {
        throw new Error('La suscripción ya está cancelada.')
      }

      if (!sub.paypalSubscriptionId) {
        throw new Error('Esta suscripción no tiene un ID de PayPal asociado.')
      }

      // Capturar next_billing_time ANTES de cancelar: PayPal lo borra al cancelar,
      // y es la fecha exacta hasta la que el usuario ya pagó.
      const psBefore = await getSubscriptionByPaypalId(sub.paypalSubscriptionId)
      const nextBillingBefore = psBefore?.billing_info?.next_billing_time
      const lastPaymentBefore = psBefore?.billing_info?.last_payment?.time

      await cancelSubscriptionByPaypalId(
        sub.paypalSubscriptionId,
        'Customer requested cancellation'
      )

      const ps = await getSubscriptionByPaypalId(sub.paypalSubscriptionId)
      const plan = await prisma.subscriptionPlan.findUnique({
        where: { id: sub.subscriptionPlanId },
        select: { interval: true }
      })
      const endDate = computePaidPeriodEnd({
        nextBillingTime: nextBillingBefore,
        lastPaymentTime: lastPaymentBefore ?? sub.lastPayment,
        interval: plan?.interval
      })
      const keepActive = endDate > new Date()

      const updated = await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status: ps?.status ?? 'CANCELLED',
          active: keepActive,
          endDate
        }
      })

      return { status: true, data: updated }
    },
    {
      params: t.Object({ id: t.String() }),
      response: t.Object({
        status: t.Boolean(),
        data: t.Any()
      })
    }
  )
