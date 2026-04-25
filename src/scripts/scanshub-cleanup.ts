/**
 * Script one-shot para:
 *   1. Soft-delete de 5 mangaCustom que scanshub ya no quiere (y sus chapters).
 *   2. Soft-delete del MangaJoint de mieruko-chan para que cada scan muestre su
 *      manga individualmente en vez de redirigir al joint.
 *
 * Uso: bun run src/scripts/scanshub-cleanup.ts [--dry-run]
 */

import { prisma } from '../models/prisma';
const isDryRun = process.argv.includes('--dry-run');

// Per-scan list of mangaSlugs to soft-delete. Add new entries here for new
// cleanup batches; previously-deleted entries become no-ops on re-run.
const MANGAS_TO_DELETE: Array<{ scan: string; slug: string }> = [
  { scan: 'scanshub', slug: 'haha-no-ai-wa-mama-naranai' },
  { scan: 'scanshub', slug: 'keishouki-shin-unbreaker' },
  { scan: 'scanshub', slug: 'un-maestro-de-mazmorras-inmortal-un-aventurero-de-bajo-rango-traicionado-y-abandonado-jura-vengarse-de-sus-antiguas-companeras-de-aventuras' },
  { scan: 'scanshub', slug: 'misiones-secretas-del-gremio-de-cazadores-como-soy-de-rango-sss-las-misiones-eroticas-no-me-suponen-ningun-problema' },
  { scan: 'scanshub', slug: 'moto-mahou-shoujo-no-onee-san-wa-koi-wo-shiritai' },
  { scan: 'doujinclub', slug: 'mi-hermanita-me-deja-hacerselo-en-los-dias-multiplo-de-3' },
];
const BROKEN_JOINT_MANGA_SLUG = 'mieruko-chan';

async function main() {
  console.log(isDryRun ? '🔍 DRY RUN — no se escribe nada\n' : '🔧 LIVE RUN\n');
  const now = new Date();

  // --- 1. Soft-delete mangaCustom + chapters ---
  const orgCache = new Map<string, { id: number; name: string }>();
  for (const { scan, slug } of MANGAS_TO_DELETE) {
    let org = orgCache.get(scan) ?? null;
    if (!org) {
      const found = await prisma.organization.findUnique({
        where: { slug: scan },
        select: { id: true, name: true },
      });
      if (!found) {
        console.log(`  ⚠️  Organización '${scan}' no encontrada — saltando ${slug}`);
        continue;
      }
      org = found;
      orgCache.set(scan, org);
    }

    const mc = await prisma.mangaCustom.findFirst({
      where: { organizationId: org.id, deletedAt: null, manga: { slug } },
      select: {
        id: true,
        title: true,
        _count: { select: { chapters: { where: { deletedAt: null } } } },
      },
    });
    if (!mc) {
      console.log(`  ⚠️  [${scan}] ${slug} — no encontrado (ya borrado?)`);
      continue;
    }
    console.log(`  → [${scan}] ${mc.title} (mangaCustom id=${mc.id}, ${mc._count.chapters} chapters)`);
    if (!isDryRun) {
      await prisma.$transaction([
        prisma.chapter.updateMany({
          where: { mangaCustomId: mc.id, deletedAt: null },
          data: { deletedAt: now },
        }),
        prisma.mangaCustom.update({ where: { id: mc.id }, data: { deletedAt: now } }),
      ]);
    }
  }

  // --- 2. Desenlazar el joint roto de mieruko-chan ---
  console.log(`\nBuscando joint activo para manga '${BROKEN_JOINT_MANGA_SLUG}'...`);
  const manga = await prisma.manga.findUnique({
    where: { slug: BROKEN_JOINT_MANGA_SLUG },
    select: { id: true, title: true },
  });
  if (!manga) {
    console.log(`  ⚠️  Manga '${BROKEN_JOINT_MANGA_SLUG}' no existe`);
  } else {
    const joint = await prisma.mangaJoint.findFirst({
      where: { mangaId: manga.id, deletedAt: null },
      select: { id: true, slug: true, title: true },
    });
    if (!joint) {
      console.log(`  ✅ Ya no hay joint activo para ${manga.title}`);
    } else {
      console.log(`  → Joint activo: ${joint.title} (slug=${joint.slug}, id=${joint.id})`);
      if (!isDryRun) {
        await prisma.mangaJoint.update({ where: { id: joint.id }, data: { deletedAt: now } });
      }
    }
  }

  console.log(isDryRun ? '\n✅ DRY RUN completo' : '\n✅ Listo');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
