/**
 * Script para encontrar y unificar perfiles de manga duplicados dentro de una organización.
 *
 * Uso: bun run src/scripts/merge-duplicate-manga.ts [--dry-run]
 *
 * El script:
 * 1. Busca MangaCustom duplicados (mismo mangaId + organizationId)
 * 2. Mantiene el que tenga más datos (capítulos, géneros, etc.)
 * 3. Mueve capítulos del duplicado al principal
 * 4. Soft-deletes el duplicado
 */

import { PrismaClient } from '../../prisma-generated/client';

const prisma = new PrismaClient();

const isDryRun = process.argv.includes('--dry-run');

async function findAndMergeDuplicates() {
  console.log(isDryRun ? '🔍 DRY RUN - No changes will be made\n' : '🔧 LIVE RUN - Changes will be applied\n');

  // Find duplicate mangaCustom entries (same mangaId + organizationId, not deleted)
  const duplicates = await prisma.$queryRaw<Array<{ mangaId: number; organizationId: number; count: bigint }>>`
    SELECT "mangaId", "organizationId", COUNT(*) as count
    FROM "manga_custom"
    WHERE "deletedAt" IS NULL
    GROUP BY "mangaId", "organizationId"
    HAVING COUNT(*) > 1
  `;

  if (duplicates.length === 0) {
    console.log('✅ No se encontraron duplicados.');
    return;
  }

  console.log(`⚠️  Se encontraron ${duplicates.length} grupo(s) de duplicados:\n`);

  for (const dup of duplicates) {
    const mangaCustoms = await prisma.mangaCustom.findMany({
      where: {
        mangaId: dup.mangaId,
        organizationId: dup.organizationId,
        deletedAt: null,
      },
      include: {
        manga: { select: { title: true, slug: true } },
        organization: { select: { name: true, slug: true } },
        chapters: { where: { deletedAt: null }, select: { id: true, number: true, title: true } },
        genres: { select: { id: true, name: true } },
        subscriptionPlansCanReadUnreleased: { select: { id: true } },
        subscriptionPlansCanReadReleased: { select: { id: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`📖 Manga: "${mangaCustoms[0].manga.title}" en ${mangaCustoms[0].organization.name}`);
    console.log(`   Duplicados encontrados: ${mangaCustoms.length}`);

    // Pick the one with the most data as the primary
    const scored = mangaCustoms.map(mc => ({
      mc,
      score: mc.chapters.length * 10 + mc.genres.length + (mc.title ? 1 : 0) + (mc.description ? 1 : 0) + (mc.imageUrl ? 1 : 0),
    }));
    scored.sort((a, b) => b.score - a.score);

    const primary = scored[0].mc;
    const duplicatesToRemove = scored.slice(1).map(s => s.mc);

    console.log(`   ✅ Mantener: ID ${primary.id} (${primary.chapters.length} capítulos, ${primary.genres.length} géneros, score: ${scored[0].score})`);

    for (const dupManga of duplicatesToRemove) {
      const dupScore = scored.find(s => s.mc.id === dupManga.id)!.score;
      console.log(`   ❌ Eliminar: ID ${dupManga.id} (${dupManga.chapters.length} capítulos, ${dupManga.genres.length} géneros, score: ${dupScore})`);

      if (!isDryRun) {
        // Move chapters from duplicate to primary
        if (dupManga.chapters.length > 0) {
          const existingNumbers = new Set(primary.chapters.map(ch => ch.number));
          for (const ch of dupManga.chapters) {
            if (!existingNumbers.has(ch.number)) {
              await prisma.chapter.update({
                where: { id: ch.id },
                data: { mangaCustomId: primary.id },
              });
              console.log(`      📄 Movido capítulo ${ch.number} al perfil principal`);
            } else {
              console.log(`      ⚠️  Capítulo ${ch.number} ya existe en el principal, soft-delete del duplicado`);
              await prisma.chapter.update({
                where: { id: ch.id },
                data: { deletedAt: new Date() },
              });
            }
          }
        }

        // Merge genres
        if (dupManga.genres.length > 0) {
          const existingGenreIds = new Set(primary.genres.map(g => g.id));
          const newGenres = dupManga.genres.filter(g => !existingGenreIds.has(g.id));
          if (newGenres.length > 0) {
            await prisma.mangaCustom.update({
              where: { id: primary.id },
              data: {
                genres: {
                  connect: newGenres.map(g => ({ id: g.id })),
                },
              },
            });
            console.log(`      🏷️  Conectados ${newGenres.length} géneros adicionales`);
          }
        }

        // Merge subscription plans
        if (dupManga.subscriptionPlansCanReadUnreleased.length > 0) {
          const existingPlanIds = new Set(primary.subscriptionPlansCanReadUnreleased.map(p => p.id));
          const newPlans = dupManga.subscriptionPlansCanReadUnreleased.filter(p => !existingPlanIds.has(p.id));
          if (newPlans.length > 0) {
            await prisma.mangaCustom.update({
              where: { id: primary.id },
              data: {
                subscriptionPlansCanReadUnreleased: {
                  connect: newPlans.map(p => ({ id: p.id })),
                },
              },
            });
          }
        }

        if (dupManga.subscriptionPlansCanReadReleased.length > 0) {
          const existingPlanIds = new Set(primary.subscriptionPlansCanReadReleased.map(p => p.id));
          const newPlans = dupManga.subscriptionPlansCanReadReleased.filter(p => !existingPlanIds.has(p.id));
          if (newPlans.length > 0) {
            await prisma.mangaCustom.update({
              where: { id: primary.id },
              data: {
                subscriptionPlansCanReadReleased: {
                  connect: newPlans.map(p => ({ id: p.id })),
                },
              },
            });
          }
        }

        // Copy data from duplicate to primary if primary is missing it
        const updateData: any = {};
        if (!primary.title && dupManga.title) updateData.title = dupManga.title;
        if (!primary.description && dupManga.description) updateData.description = dupManga.description;
        if (!primary.shortDescription && dupManga.shortDescription) updateData.shortDescription = dupManga.shortDescription;
        if (!primary.imageUrl && dupManga.imageUrl) updateData.imageUrl = dupManga.imageUrl;
        if (!primary.bannerUrl && dupManga.bannerUrl) updateData.bannerUrl = dupManga.bannerUrl;

        if (Object.keys(updateData).length > 0) {
          await prisma.mangaCustom.update({
            where: { id: primary.id },
            data: updateData,
          });
          console.log(`      📝 Copiados datos faltantes: ${Object.keys(updateData).join(', ')}`);
        }

        // Soft-delete the duplicate
        await prisma.mangaCustom.update({
          where: { id: dupManga.id },
          data: { deletedAt: new Date() },
        });
        console.log(`      🗑️  Soft-deleted manga custom ID ${dupManga.id}`);
      }
    }
    console.log('');
  }

  console.log(isDryRun ? '🔍 DRY RUN completado. Ejecuta sin --dry-run para aplicar cambios.' : '✅ Limpieza completada.');
}

findAndMergeDuplicates()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
