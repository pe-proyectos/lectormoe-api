import { prisma } from '../models/prisma';

async function main() {
  // 1. Find the MangaJoint
  const joint = await prisma.mangaJoint.findFirst({
    where: { slug: 'darwin-incident' },
    include: {
      manga: { select: { id: true, slug: true, title: true } },
      members: {
        include: {
          organization: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });

  if (!joint) {
    console.log('No MangaJoint found with slug=darwin-incident');
    return;
  }

  console.log('=== JOINT ===');
  console.log(JSON.stringify({
    id: joint.id,
    mangaId: joint.mangaId,
    slug: joint.slug,
    title: joint.title,
    deletedAt: joint.deletedAt,
    createdAt: joint.createdAt,
  }, null, 2));

  console.log('\n=== JOINT MEMBERS ===');
  for (const m of joint.members) {
    console.log(JSON.stringify({
      organizationId: m.organizationId,
      status: m.status,
      role: m.role,
      organization: m.organization,
    }, null, 2));
  }

  // 2. Manga
  console.log('\n=== MANGA ===');
  console.log(JSON.stringify(joint.manga, null, 2));

  // 3. MangaCustom records for that mangaId
  const mcs = await prisma.mangaCustom.findMany({
    where: { mangaId: joint.mangaId },
    select: {
      id: true,
      organizationId: true,
      deletedAt: true,
      organization: { select: { id: true, name: true, slug: true } },
    },
  });

  console.log('\n=== MANGA_CUSTOMS ===');
  console.log(JSON.stringify(mcs, null, 2));

  // 4. Chapters linked to this joint
  const chapters = await prisma.chapter.findMany({
    where: { jointId: joint.id },
    select: {
      id: true,
      number: true,
      title: true,
      mangaCustomId: true,
      uploadedByOrganizationId: true,
      deletedAt: true,
      releasedAt: true,
    },
    orderBy: { number: 'asc' },
  });

  console.log(`\n=== CHAPTERS linked to joint #${joint.id} (${chapters.length} total) ===`);
  for (const c of chapters) {
    console.log(JSON.stringify(c, null, 2));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
