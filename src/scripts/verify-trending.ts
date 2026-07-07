import { getRecentlyAdded } from '../controllers/landing/recently-added'
import { getTrending } from '../controllers/landing/trending'
import { prisma } from '../models/prisma'

for (const period of ['day', 'week', 'month'] as const) {
  const items = await getTrending(period, 10, false)
  console.log(`\n=== TRENDING ${period} (${items.length}) ===`)
  for (const it of items.slice(0, 10)) {
    console.log(`  ${it.readers} lectores · ${it.title} (${it.scanName})`)
    if (it.chapters.some((c: any) => !(c.releasedAt instanceof Date)))
      console.log('  ⚠️ releasedAt no-Date')
  }
}

const recent = await getRecentlyAdded(10, false)
console.log(`\n=== RECENTLY ADDED (${recent.length}) ===`)
for (const it of recent)
  console.log(
    `  ${it.createdAt.toISOString().slice(0, 10)} · ${it.title} (${it.scanName})`
  )

await prisma.$disconnect()
process.exit(0)
