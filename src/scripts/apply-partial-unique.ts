import { prisma } from '../models/prisma';

async function main() {
  const result = await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS manga_joint_active_unique
     ON manga_joint ("mangaId")
     WHERE "deletedAt" IS NULL;`
  );
  console.log(`OK (rows affected reported: ${result})`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
