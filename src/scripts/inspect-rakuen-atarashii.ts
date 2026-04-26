import { prisma } from '../models/prisma';

async function main() {
  const org = await prisma.organization.findUnique({ where: { slug: 'rakuen' }, select: { id: true, name: true } });
  console.log('Org rakuen:', org);

  const manga = await prisma.manga.findUnique({ where: { slug: 'atarashii-kimi-e' }, select: { id: true, slug: true, title: true } });
  console.log('Manga atarashii-kimi-e:', manga);

  if (!manga) return;

  const mc = await prisma.mangaCustom.findFirst({
    where: { mangaId: manga.id, organizationId: org?.id },
    include: { _count: { select: { chapters: true } } },
  });
  console.log('MangaCustom in rakuen:', mc);

  const joints = await prisma.mangaJoint.findMany({
    where: { mangaId: manga.id },
    include: { members: { include: { organization: { select: { slug: true, id: true } } } } },
  });
  console.log('Joints for this mangaId:');
  for (const j of joints) {
    console.log(`  Joint #${j.id}  slug="${j.slug}"  title="${j.title}"  deletedAt=${j.deletedAt ?? '-'}`);
    for (const m of j.members) {
      console.log(`    member: ${m.organization.slug}(#${m.organization.id})  role=${m.role}  status=${m.status}`);
    }
    const chCount = await prisma.chapter.count({ where: { jointId: j.id, deletedAt: null } });
    console.log(`    live chapters with jointId=${j.id}: ${chCount}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
