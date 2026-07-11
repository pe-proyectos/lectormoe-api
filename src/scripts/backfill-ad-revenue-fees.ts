// Backfill contable de publicidad: las filas AD_REVENUE/ADSENSE creadas desde
// feb 2026 registraban solo la mitad de la org (beforeFees = amount, capibaraFee 0)
// aunque la plataforma retenia su 50% antes de repartir. Este script las corrige
// para que el dashboard cuente esa mitad: beforeFees = amount * 2, capibaraFee =
// amount. NO toca `amount` (el dinero de la org queda identico).
// Uso: bun ... [--apply] (sin flag = dry-run).
import { prisma } from '../models/prisma'

const apply = process.argv.includes('--apply')

// Solo filas donde beforeFees == amount y capibaraFee == 0 (el patron roto).
// Las filas viejas correctas (beforeFees = 2x amount, capibaraFee > 0) no matchean.
const rows = await prisma.organizationTransaction.findMany({
  where: {
    type: 'EARNING',
    status: 'COMPLETED',
    origin: { in: ['AD_REVENUE', 'ADSENSE'] },
    capibaraFee: 0,
    amount: { gt: 0 }
  },
  select: { id: true, origin: true, amount: true, beforeFeesAmount: true, createdAt: true, organization: { select: { slug: true } } }
})

const targets = rows.filter((r) => Math.abs(r.beforeFeesAmount - r.amount) < 0.005)
const skipped = rows.length - targets.length

let totalOrg = 0
for (const r of targets) totalOrg += r.amount

console.log(`${apply ? 'APLICANDO' : 'DRY-RUN'}: ${targets.length} filas a corregir (${skipped} descartadas por no matchear el patron)`)
console.log(`Suma amount (mitad org): $${totalOrg.toFixed(2)} -> capibaraFee total a registrar: $${totalOrg.toFixed(2)}`)
const byOrigin = new Map<string, { n: number; sum: number }>()
for (const r of targets) {
  const g = byOrigin.get(r.origin) || { n: 0, sum: 0 }
  g.n++
  g.sum += r.amount
  byOrigin.set(r.origin, g)
}
for (const [o, g] of byOrigin) console.log(`- ${o}: ${g.n} filas, $${g.sum.toFixed(2)} org / $${g.sum.toFixed(2)} capibara`)

if (apply && targets.length > 0) {
  let updated = 0
  for (const r of targets) {
    await prisma.organizationTransaction.update({
      where: { id: r.id },
      data: { beforeFeesAmount: r.amount * 2, capibaraFee: r.amount }
    })
    updated++
  }
  console.log(`\nActualizadas ${updated} filas.`)
} else if (!apply) {
  console.log('\nSin cambios (dry-run). Corre con --apply para aplicar.')
}

await prisma.$disconnect()
process.exit(0)
