import { cron, Patterns } from '@elysiajs/cron'
import { Elysia, t } from 'elysia'
import { prisma } from '../../models/prisma'
import { loggedOptional } from '../../plugins/auth'
import { repartirLecturaDelMes, sincronizarPagosPlataforma } from '../../services/capibara-reparto'
import {
  LANZADO,
  LIMITES,
  limitesParaNivel,
  nivelDesdeSuscripciones,
} from '../../util/capibara-plans'
import { wrapCron } from '../../util/cron-alert'
import { getSubscriptionByPaypalId, reviseSubscription } from '../../util/paypal'

const SITIO = Bun.env.PUBLIC_SITE_URL || 'https://capibaratraductor.com'

/** Suscripcion Capibara activa del usuario, si tiene. */
async function subPlataformaActiva(userId: number) {
  return prisma.subscription.findFirst({
    where: { userId, active: true, subscriptionPlan: { isPlatform: true } },
    include: { subscriptionPlan: true },
    orderBy: { createdAt: 'desc' },
  })
}

export const router = () =>
  new Elysia()
    .use(loggedOptional())

    // Planes Capibara para la pagina de suscripciones. Antes del lanzamiento
    // solo se ven con ?preview=1, para poder probarlos sin anunciarlos.
    .get(
      '/api/capibara-plans',
      async ({ user, query }) => {
        const visible = LANZADO || query?.preview === '1'
        const planes = visible
          ? await prisma.subscriptionPlan.findMany({
              where: { isPlatform: true, active: true },
              select: { id: true, planId: true, name: true, tier: true, interval: true, price: true, currency: true },
              orderBy: [{ price: 'asc' }],
            })
          : []
        const nivel = user ? nivelDesdeSuscripciones((user as any).subscriptions || []) : 'gratis'
        const actual = user ? await subPlataformaActiva(user.id) : null
        return {
          status: true,
          data: {
            lanzado: LANZADO,
            visible,
            nivel,
            limites: limitesParaNivel(nivel),
            // Tabla completa para pintar las tarjetas: una sola fuente de verdad.
            limitesPorNivel: { gratis: LIMITES.gratis, lector: LIMITES.lector, plus: LIMITES.plus, premium: LIMITES.premium },
            planes,
            actual: actual
              ? { planId: actual.subscriptionPlanId, tier: actual.subscriptionPlan.tier, interval: actual.subscriptionPlan.interval }
              : null,
          },
        }
      },
      { query: t.Optional(t.Object({ preview: t.Optional(t.String()) })) }
    )

    // Cambiar de plan Capibara (subir o bajar). Devuelve el enlace de
    // aprobacion de PayPal cuando hace falta; si no, el cambio ya queda hecho.
    .post(
      '/api/capibara-plans/change',
      async ({ user, body }) => {
        if (!user) throw new Error('Debes iniciar sesión.')
        const actual = await subPlataformaActiva(user.id)
        if (!actual) throw new Error('No tienes un plan Capibara activo.')
        const destino = await prisma.subscriptionPlan.findFirst({
          where: { id: body.planId, isPlatform: true, active: true },
        })
        if (!destino) throw new Error('Ese plan no existe.')
        if (destino.id === actual.subscriptionPlanId) throw new Error('Ya tienes ese plan.')

        const vuelta = `${SITIO}${body.returnPath || '/subscriptions'}`
        const sep = vuelta.includes('?') ? '&' : '?'
        const { approveUrl } = await reviseSubscription(
          actual.paypalSubscriptionId,
          destino.planId,
          `${vuelta}${sep}cambio=ok&plan=${destino.id}`,
          `${vuelta}${sep}cambio=cancelado`
        )
        if (approveUrl) return { status: true, data: { approveUrl } }

        await prisma.subscription.update({ where: { id: actual.id }, data: { subscriptionPlanId: destino.id } })
        return { status: true, data: { approveUrl: null, cambiado: true } }
      },
      { body: t.Object({ planId: t.Number(), returnPath: t.Optional(t.String()) }) }
    )

    // Vuelta de PayPal tras aprobar el cambio. No se fia del parametro: comprueba
    // en PayPal que la suscripcion ya esta en el plan nuevo antes de aplicarlo.
    .post(
      '/api/capibara-plans/change/confirm',
      async ({ user, body }) => {
        if (!user) throw new Error('Debes iniciar sesión.')
        const actual = await subPlataformaActiva(user.id)
        if (!actual) throw new Error('No tienes un plan Capibara activo.')
        const destino = await prisma.subscriptionPlan.findFirst({
          where: { id: body.planId, isPlatform: true },
        })
        if (!destino) throw new Error('Ese plan no existe.')
        const enPaypal = await getSubscriptionByPaypalId(actual.paypalSubscriptionId)
        if (enPaypal?.plan_id !== destino.planId) {
          return { status: false, message: 'PayPal aún no confirma el cambio. Vuelve a intentarlo en unos minutos.' }
        }
        await prisma.subscription.update({ where: { id: actual.id }, data: { subscriptionPlanId: destino.id } })
        return { status: true, data: { cambiado: true } }
      },
      { body: t.Object({ planId: t.Number() }) }
    )

    .use(
      cron({
        name: 'capibara-sync-pagos',
        pattern: Patterns.everyHours(6),
        run: wrapCron('capibara-sync-pagos', async () => {
          const r = await sincronizarPagosPlataforma()
          console.log(`[capibara] cobros: ${r.nuevos} nuevos de ${r.suscripciones} suscripciones (errores: ${r.errores})`)
        }),
      })
    )
    .use(
      cron({
        name: 'capibara-reparto-lectura',
        // Dia 2 a las 04:00, despues del reparto de publicidad (03:00). Antes
        // sincroniza para no dejar fuera cobros de las ultimas horas del mes.
        pattern: '0 4 2 * *',
        run: wrapCron('capibara-reparto-lectura', async () => {
          await sincronizarPagosPlataforma()
          const ahora = new Date()
          const prev = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1)
          const r = await repartirLecturaDelMes(prev.getFullYear(), prev.getMonth())
          console.log(`[capibara] reparto ${r.mes}: $${r.repartido} entre ${r.scans} scans (${r.pagos} cobros, sin lectura $${r.sinLectura})`)
        }),
      })
    )
