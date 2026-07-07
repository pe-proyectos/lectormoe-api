import { prisma } from '../src/models/prisma'
await prisma.$executeRawUnsafe(`ALTER TABLE "manga_custom" ADD COLUMN IF NOT EXISTS "finalChapterNumber" DOUBLE PRECISION;`)
await prisma.$executeRawUnsafe(`ALTER TABLE "manga_joint" ADD COLUMN IF NOT EXISTS "finalChapterNumber" DOUBLE PRECISION;`)
console.log('OK columns added')
await prisma.$disconnect()
process.exit(0)
