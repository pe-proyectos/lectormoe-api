import { cron } from '@elysiajs/cron'
import { Elysia } from 'elysia'
import { prisma } from '../../models/prisma'
import { executeDraw, resumeStuckDraws } from '../../services/raffle-draw'
import { wrapCron } from '../../util/cron-alert'

async function processDueRaffles() {
  try {
    const due = await prisma.raffle.findMany({
      where: {
        status: 'active',
        drawType: 'countdown',
        drawAt: { lte: new Date() },
        deletedAt: null
      }
    })
    if (due.length === 0) return
    console.log(`[raffle cron] Processing ${due.length} due raffle(s)`)
    for (const r of due) {
      try {
        await executeDraw(r.id)
      } catch (e) {
        console.error(`[raffle cron] draw failed for #${r.id}`, e)
      }
    }
  } catch (e) {
    console.error('[raffle cron] critical error:', e)
  }
}

export const router = () =>
  new Elysia()
    .use(
      cron({
        name: 'raffle-due-draws',
        // 6-field pattern: every 5 seconds. The minute-precision pattern
        // ("* * * * *") was leaving a "Sorteando..." dead zone of up to
        // 60s between the FE countdown hitting 0 and the backend actually
        // firing executeDraw — bumping to 5s tightens that to the
        // user-perceptible blink between drawAt and the phase splash.
        pattern: '*/5 * * * * *',
        run: wrapCron('raffle-due-draws', processDueRaffles)
      })
    )
    // Recovery tick: if the API process restarted mid-tournament, the
    // setTimeout chain that drives eliminations died with it. This cron
    // scans for raffles in status="drawing" with stale lastEliminationAt
    // and resumes their elimination chain (or finalises directly if all
    // eliminations were already committed before the crash).
    // Stays at minute precision — recovery doesn't need to be fast.
    .use(
      cron({
        name: 'raffle-resume-stuck',
        pattern: '* * * * *',
        run: wrapCron('raffle-resume-stuck', resumeStuckDraws)
      })
    )
