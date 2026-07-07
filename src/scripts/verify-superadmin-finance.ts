// Verificación cruzada Tarea 25: el saldo por org de getOrgStats debe ser
// idéntico (centavo a centavo) al balance de la página de finanzas del scan:
// sum(EARNING COMPLETED amount) - sum(WITHDRAWAL COMPLETED amount).
import { getOrgStats } from '../controllers/superadmin/stats'
import { prisma } from '../models/prisma'

const orgStats = await getOrgStats()

// Referencia independiente por transacciones crudas
const txs = await prisma.organizationTransaction.findMany({
  where: { status: 'COMPLETED' },
  select: { organizationId: true, type: true, amount: true }
})
const ref = new Map<number, { e: number; w: number }>()
for (const t of txs) {
  const r = ref.get(t.organizationId) ?? { e: 0, w: 0 }
  if (t.type === 'EARNING') r.e += t.amount
  else if (t.type === 'WITHDRAWAL') r.w += t.amount
  ref.set(t.organizationId, r)
}

let failures = 0
const withMoney = orgStats.filter((o) => o.totalRevenue > 0 || o.totalWithdrawn > 0)
console.log(`Orgs con movimientos: ${withMoney.length}`)
for (const o of withMoney) {
  const r = ref.get(o.id) ?? { e: 0, w: 0 }
  const expected = r.e - r.w
  const ok = Math.abs(o.saldo - expected) < 0.005
  if (!ok) failures++
  console.log(
    `${ok ? 'OK  ' : 'FAIL'} ${o.slug}: saldo=${o.saldo.toFixed(2)} esperado=${expected.toFixed(2)} (neto=${r.e.toFixed(2)} retirado=${r.w.toFixed(2)})`
  )
}

const tamt = orgStats.find((o) => o.slug === 'tamt')
console.log(`\ntamt: saldo=${tamt?.saldo.toFixed(2)} (esperado 0.00)`)
if (tamt && Math.abs(tamt.saldo) > 0.005) failures++

console.log(failures === 0 ? '\n✅ Finanzas cuadran' : `\n❌ ${failures} descuadres`)
await prisma.$disconnect()
process.exit(failures === 0 ? 0 : 1)
