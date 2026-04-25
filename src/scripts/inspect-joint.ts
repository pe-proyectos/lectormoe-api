import { prisma } from '../models/prisma';

const JOINT_SLUG = 'mieruko-chan-b';
const SCAN_SLUGS = ['tamt', 'antipatreon'];

async function main() {
  const joint = await prisma.mangaJoint.findUnique({
    where: { slug: JOINT_SLUG },
    include: {
      manga: { select: { id: true, slug: true, title: true } },
      members: {
        include: {
          organization: { select: { id: true, slug: true, name: true } },
        },
      },
    },
  });

  if (!joint) {
    console.log(`No se encontró joint con slug=${JOINT_SLUG}`);
    return;
  }

  console.log(`Joint #${joint.id} "${joint.title}"`);
  console.log(`  base mangaId=${joint.manga.id}, manga.slug=${joint.manga.slug}, manga.title=${joint.manga.title}`);
  console.log(`  members:`);
  for (const m of joint.members) {
    console.log(`    - org ${m.organization.slug} (#${m.organization.id})  role=${m.role}  status=${m.status}`);
  }

  const jointChapters = await prisma.chapter.findMany({
    where: { jointId: joint.id },
    select: { id: true, number: true, title: true, mangaCustomId: true, deletedAt: true, uploadedByOrganizationId: true, releasedAt: true },
    orderBy: { number: 'asc' },
  });
  console.log(`\nChapters with jointId=${joint.id}: ${jointChapters.length}`);
  for (const c of jointChapters) {
    console.log(`  #${c.id}  cap.${c.number}  "${c.title}"  uploaderOrg=${c.uploadedByOrganizationId}  mangaCustomId=${c.mangaCustomId ?? 'NULL'}  deletedAt=${c.deletedAt ?? '-'}`);
  }

  console.log('\n--- Per-scan MangaCustom + chapters (same manga.id):');
  for (const scanSlug of SCAN_SLUGS) {
    const org = await prisma.organization.findUnique({ where: { slug: scanSlug }, select: { id: true, name: true } });
    if (!org) {
      console.log(`  ${scanSlug}: org no encontrada`);
      continue;
    }
    const mc = await prisma.mangaCustom.findFirst({
      where: { organizationId: org.id, mangaId: joint.manga.id },
      select: { id: true, title: true, deletedAt: true },
    });
    if (!mc) {
      console.log(`  ${scanSlug} (#${org.id}): no tiene MangaCustom para mangaId=${joint.manga.id}`);
      continue;
    }
    const chapters = await prisma.chapter.findMany({
      where: { mangaCustomId: mc.id },
      select: { id: true, number: true, title: true, jointId: true, deletedAt: true, releasedAt: true },
      orderBy: { number: 'asc' },
    });
    console.log(`\n  ${scanSlug} (#${org.id})  MangaCustom #${mc.id} "${mc.title}" (deletedAt=${mc.deletedAt ?? '-'})`);
    console.log(`    chapters: ${chapters.length}`);
    for (const c of chapters) {
      console.log(`      #${c.id}  cap.${c.number}  "${c.title}"  jointId=${c.jointId ?? 'NULL'}  deletedAt=${c.deletedAt ?? '-'}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
