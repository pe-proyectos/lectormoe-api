// Aplica columnas/tablas aditivas nullable directamente (la tabla _prisma_migrations
// está desincronizada con el esquema real, así que no usamos migrate deploy).
// Todo idempotente con IF NOT EXISTS. NUNCA DROP.
import { prisma } from '../models/prisma'

const statements: string[] = [
  // Tarea 5: capítulo final
  `ALTER TABLE "manga_custom" ADD COLUMN IF NOT EXISTS "finalChapterNumber" DOUBLE PRECISION;`,
  `ALTER TABLE "manga_joint" ADD COLUMN IF NOT EXISTS "finalChapterNumber" DOUBLE PRECISION;`
]

for (const sql of statements) {
  await prisma.$executeRawUnsafe(sql)
  console.log('OK:', sql.slice(0, 70))
}
console.log('\n✅ Migraciones aplicadas')
await prisma.$disconnect()
process.exit(0)
