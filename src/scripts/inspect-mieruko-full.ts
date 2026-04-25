import { prisma } from '../models/prisma';

async function main() {
  // Find every Manga, MangaCustom, MangaJoint, and Chapter related to "mieruko"
  const mangas = await prisma.manga.findMany({
    where: { slug: { contains: 'mieruko', mode: 'insensitive' } },
    select: { id: true, slug: true, title: true },
  });
  console.log(`=== Manga rows matching "mieruko" ===`);
  for (const m of mangas) console.log(`  Manga #${m.id}  slug="${m.slug}"  title="${m.title}"`);

  for (const m of mangas) {
    console.log(`\n=== MangaCustoms for Manga #${m.id} (${m.slug}) ===`);
    const mcs = await prisma.mangaCustom.findMany({
      where: { mangaId: m.id },
      include: {
        organization: { select: { id: true, slug: true, name: true } },
        _count: { select: { chapters: true } },
      },
    });
    for (const mc of mcs) {
      const chCount = await prisma.chapter.count({ where: { mangaCustomId: mc.id, deletedAt: null } });
      const chDeleted = await prisma.chapter.count({ where: { mangaCustomId: mc.id, deletedAt: { not: null } } });
      console.log(`  MangaCustom #${mc.id}  org=${mc.organization.slug}(#${mc.organization.id})  deletedAt=${mc.deletedAt ?? '-'}  chapters: ${chCount} live, ${chDeleted} deleted`);
    }

    console.log(`\n=== MangaJoints for Manga #${m.id} (${m.slug}) ===`);
    const joints = await prisma.mangaJoint.findMany({
      where: { mangaId: m.id },
      include: {
        members: {
          include: { organization: { select: { slug: true, id: true } } },
        },
      },
    });
    for (const j of joints) {
      const chCount = await prisma.chapter.count({ where: { jointId: j.id, deletedAt: null } });
      const chDeleted = await prisma.chapter.count({ where: { jointId: j.id, deletedAt: { not: null } } });
      console.log(`  Joint #${j.id}  slug="${j.slug}"  title="${j.title}"  deletedAt=${j.deletedAt ?? '-'}  chapters: ${chCount} live, ${chDeleted} deleted`);
      for (const mem of j.members) {
        console.log(`    member: ${mem.organization.slug}(#${mem.organization.id})  role=${mem.role}  status=${mem.status}`);
      }
    }
  }

  // Orphan chapters: jointId points to a deleted joint, OR jointId+mangaCustomId both null
  console.log('\n=== Orphan / cross-linked chapters of interest ===');
  for (const m of mangas) {
    const allMcIds = (await prisma.mangaCustom.findMany({ where: { mangaId: m.id }, select: { id: true } })).map(x => x.id);
    const allJointIds = (await prisma.mangaJoint.findMany({ where: { mangaId: m.id }, select: { id: true } })).map(x => x.id);

    const dual = await prisma.chapter.count({
      where: { mangaCustomId: { in: allMcIds }, jointId: { in: allJointIds } },
    });
    console.log(`  Manga #${m.id}: chapters with BOTH mangaCustomId+jointId set: ${dual}`);

    const onlyJointDeleted = await prisma.chapter.findMany({
      where: {
        jointId: { in: allJointIds },
        mangaCustomId: null,
        joint: { deletedAt: { not: null } },
        deletedAt: null,
      },
      select: { id: true, number: true, jointId: true },
    });
    console.log(`  Manga #${m.id}: live chapters whose only parent joint is soft-deleted: ${onlyJointDeleted.length}`);
    if (onlyJointDeleted.length > 0) {
      console.log(`    sample ids:`, onlyJointDeleted.slice(0, 5).map(c => `#${c.id}(cap.${c.number}, joint=${c.jointId})`).join(', '));
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
