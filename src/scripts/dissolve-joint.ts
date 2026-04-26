/**
 * Disuelve un joint a través del flow oficial. Usa el controller deleteJoint
 * que detacha cada miembro a su MangaCustom (con resolución de conflictos),
 * escribe history + audit, y soft-deletea el joint.
 *
 * Uso: bun run src/scripts/dissolve-joint.ts <jointSlug> <leaderOrgSlug>
 */
import { prisma } from '../models/prisma';
import { deleteJoint } from '../controllers/joint/delete';

async function main() {
  const jointSlug = process.argv[2];
  const leaderOrgSlug = process.argv[3];
  if (!jointSlug || !leaderOrgSlug) {
    console.error('Usage: bun run src/scripts/dissolve-joint.ts <jointSlug> <leaderOrgSlug>');
    process.exit(1);
  }

  const leader = await prisma.organization.findUnique({ where: { slug: leaderOrgSlug }, select: { id: true, name: true } });
  if (!leader) throw new Error(`Org leader '${leaderOrgSlug}' no encontrada`);

  console.log(`Disolviendo joint slug="${jointSlug}" via leader=${leader.name} (#${leader.id})`);
  const result = await deleteJoint(jointSlug, leader.id, null);
  console.log('Resultado:', result);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
