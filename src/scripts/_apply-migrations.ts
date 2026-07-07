// Aplica columnas/tablas aditivas nullable directamente (la tabla _prisma_migrations
// está desincronizada con el esquema real, así que no usamos migrate deploy).
// Todo idempotente con IF NOT EXISTS. NUNCA DROP.
import { prisma } from '../models/prisma'

const statements: string[] = [
  // Tarea 5: capítulo final
  `ALTER TABLE "manga_custom" ADD COLUMN IF NOT EXISTS "finalChapterNumber" DOUBLE PRECISION;`,
  `ALTER TABLE "manga_joint" ADD COLUMN IF NOT EXISTS "finalChapterNumber" DOUBLE PRECISION;`,
  // Tarea 17: reacciones en capítulos
  `CREATE TABLE IF NOT EXISTS "chapter_reaction" (
    "id" SERIAL PRIMARY KEY,
    "chapterId" INTEGER NOT NULL REFERENCES "chapter"("id") ON DELETE CASCADE,
    "userId" INTEGER NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "emoji" VARCHAR(8) NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now()
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "chapter_reaction_chapterId_userId_key" ON "chapter_reaction"("chapterId", "userId");`,
  `CREATE INDEX IF NOT EXISTS "chapter_reaction_chapterId_idx" ON "chapter_reaction"("chapterId");`
]

for (const sql of statements) {
  await prisma.$executeRawUnsafe(sql)
  console.log('OK:', sql.slice(0, 70))
}
console.log('\n✅ Migraciones aplicadas')
await prisma.$disconnect()
process.exit(0)
