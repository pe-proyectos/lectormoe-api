import { cron } from '@elysiajs/cron'
import { Elysia } from 'elysia'
import {
  computeMonthlyAdRevenue,
  persistMonthlyAdRevenue,
  repartirRedesPendientes
} from '../../services/ad-revenue'
import { reportCronError, wrapCron } from '../../util/cron-alert'
import { fetchAdcashRevenue } from '../../services/adcash'
import { fetchMonetagRevenue } from '../../services/monetag'

async function runMonthlyAdRevenue() {
  const now = new Date()
  // Last completed calendar month (server-local).
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const year = prev.getFullYear()
  const monthIndex = prev.getMonth()

  console.log(
    `[AdRevenue Cron] Computing for ${year}-${(monthIndex + 1).toString().padStart(2, '0')}`
  )

  const breakdown = await computeMonthlyAdRevenue(year, monthIndex)
  const result = await persistMonthlyAdRevenue(breakdown)
  console.log(
    `[AdRevenue Cron] Done. google=$${breakdown.totalGoogle.toFixed(2)} adsterra=$${breakdown.totalAdsterra.toFixed(2)} adcash=$${breakdown.totalAdcash.toFixed(2)} monetag=$${breakdown.totalMonetag.toFixed(2)} ` +
      `platformCut=$${breakdown.platformCut.toFixed(2)} scanPool=$${breakdown.scanPool.toFixed(2)} ` +
      `orgs=${result.total} inserted=${result.inserted} skipped=${result.skipped}`
  )
}

// Adcash y Monetag se reparten aparte (repartirRedesPendientes): un mes queda
// pendiente hasta que su API responde. Esta comprobacion diaria prueba las dos
// conexiones y avisa a Discord si alguna falla o no tiene token.
async function comprobarRedesDeAnuncios() {
  const hoy = new Date()
  for (const [nombre, fn] of [['Adcash', fetchAdcashRevenue], ['Monetag', fetchMonetagRevenue]] as const) {
    try {
      const usd = await fn(hoy.getFullYear(), hoy.getMonth())
      console.log(`[AdRevenue check] ${nombre} OK: $${usd.toFixed(2)} en lo que va de mes`)
    } catch (e) {
      await reportCronError(`ad-revenue-check-${nombre.toLowerCase()}`, e)
    }
  }
}

export const router = () =>
  new Elysia().use(
    cron({
      name: 'monthly-ad-revenue',
      // 03:00 server-local on the 2nd of every month — calc previous month.
      pattern: '0 3 2 * *',
      run: wrapCron('monthly-ad-revenue', runMonthlyAdRevenue)
    })
  )
  .use(
    cron({
      name: 'ad-revenue-networks-check',
      // Todos los dias a las 12:00 (hora del servidor).
      pattern: '0 12 * * *',
      run: comprobarRedesDeAnuncios
    })
  )
  .use(
    cron({
      name: 'ad-revenue-networks-pending',
      // Todos los dias a las 05:00: reparte los meses de Adcash/Monetag pendientes.
      pattern: '0 5 * * *',
      run: wrapCron('ad-revenue-networks-pending', async () => {
        for (const r of await repartirRedesPendientes()) {
          if (!r.yaRepartido) console.log(`[AdRevenue ${r.red}] ${r.mes}: $${r.total.toFixed(2)}, ${r.inserted} scans`)
        }
      })
    })
  )
