import { prisma } from '../models/prisma'

const org = await prisma.organization.findFirst({
  where: { slug: 'tamt' },
  select: { id: true, name: true, slug: true }
})
console.log('Org:', org)
if (!org) process.exit(1)

const txs = await prisma.organizationTransaction.findMany({
  where: { organizationId: org.id },
  orderBy: { createdAt: 'desc' },
  select: {
    id: true,
    type: true,
    status: true,
    amount: true,
    currency: true,
    origin: true,
    description: true,
    transactionDate: true,
    createdAt: true
  }
})

let earnings = 0
let withdrawals = 0
for (const t of txs) {
  if (t.type === 'EARNING' && t.status === 'COMPLETED') earnings += t.amount
  else if (t.type !== 'EARNING') withdrawals += t.amount
}
console.log(`\nTotal transacciones: ${txs.length}`)
console.log(`Ganancias (EARNING/COMPLETED): $${earnings.toFixed(2)}`)
console.log(`Retiros (no EARNING): $${withdrawals.toFixed(2)}`)
console.log(`Balance: $${(earnings - withdrawals).toFixed(2)}`)

console.log('\nÚltimas 15 transacciones:')
for (const t of txs.slice(0, 15)) {
  console.log(
    `  #${t.id} ${t.type} ${t.status} $${t.amount} ${t.currency} origin=${t.origin} fecha=${t.transactionDate?.toISOString()?.slice(0, 10)} desc=${t.description?.slice(0, 60)}`
  )
}

// Tipos distintos usados
const types = [...new Set(txs.map((t) => t.type))]
console.log('\nTipos usados:', types)

await prisma.$disconnect()
process.exit(0)
