/**
 * Fix puntual: migrar los 86 capítulos de tamt MangaCustom #669 al joint #20.
 * Pone jointId=20, mantiene mangaCustomId (no NULL) por compatibilidad con el
 * fix sistémico que viene después: la nueva agregación lee ambos.
 */
import { prisma } from '../models/prisma';

const JOINT_ID = 20;
const ORG_ID_TAMT = 57;
const MANGA_CUSTOM_ID = 669;

const isDryRun = process.argv.includes('--dry-run');

async function main() {
  console.log(isDryRun ? '🔍 DRY RUN' : '🔧 LIVE RUN');

  const joint = await prisma.mangaJoint.findUnique({
    where: { id: JOINT_ID },
    select: { id: true, slug: true, title: true, deletedAt: true },
  });
  if (!joint || joint.deletedAt) {
    throw new Error(`Joint #${JOINT_ID} no encontrado o soft-deleted`);
  }
  console.log(`Joint #${joint.id}  "${joint.title}"  slug=${joint.slug}`);

  const candidates = await prisma.chapter.findMany({
    where: { mangaCustomId: MANGA_CUSTOM_ID, jointId: null, deletedAt: null },
    select: { id: true, number: true },
    orderBy: { number: 'asc' },
  });
  console.log(`Capítulos a migrar: ${candidates.length}`);

  // Detect any existing chapter with same number already in the joint to avoid
  // unique violation on @@unique([number, jointId]).
  const existingNumbers = await prisma.chapter.findMany({
    where: { jointId: JOINT_ID, deletedAt: null },
    select: { number: true },
  });
  const taken = new Set(existingNumbers.map((c) => c.number));
  const willMigrate = candidates.filter((c) => !taken.has(c.number));
  const skipped = candidates.filter((c) => taken.has(c.number));
  console.log(`  ${willMigrate.length} a migrar, ${skipped.length} skipped (ya existen en el joint)`);

  if (!isDryRun && willMigrate.length > 0) {
    const result = await prisma.chapter.updateMany({
      where: {
        id: { in: willMigrate.map((c) => c.id) },
      },
      data: {
        jointId: JOINT_ID,
        uploadedByOrganizationId: ORG_ID_TAMT,
      },
    });
    console.log(`✅ Updated ${result.count} chapters`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
