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
