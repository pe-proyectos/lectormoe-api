/**
 * Idempotently upsert the global genres used by the novels/writings surface
 * (organizationId = null). Safe to re-run: existing rows are left untouched.
 *
 * Run: bun run src/scripts/seed-genres.ts
 */
import { prisma } from '../models/prisma';

// slug: minusculas, sin acentos, espacios -> guion. category: MangaDex-like.
const REQUIRED_GENRES = [
  { name: 'Contemporáneo', slug: 'contemporaneo', category: 'GENRE', description: 'Historias ambientadas en la época actual, en un entorno realista y cotidiano.' },
  { name: 'Slice of life', slug: 'slice-of-life', category: 'GENRE', description: 'Fragmentos de la vida cotidiana de los personajes.' },
  { name: 'Isekai', slug: 'isekai', category: 'GENRE', description: 'El protagonista es transportado o reencarna en otro mundo.' },
  { name: 'Wuxia', slug: 'wuxia', category: 'GENRE', description: 'Artes marciales y héroes en un mundo de cultivo marcial chino.' },
  { name: 'Xianxia', slug: 'xianxia', category: 'GENRE', description: 'Cultivo de inmortalidad, magia y seres sobrenaturales de raíz china.' },
  { name: 'LitRPG', slug: 'litrpg', category: 'GENRE', description: 'El mundo funciona con mecánicas de videojuego: niveles, estadísticas y habilidades.' },
  { name: 'Romance', slug: 'romance', category: 'GENRE', description: 'La relación amorosa entre los personajes es el eje central.' },
  { name: 'Drama', slug: 'drama', category: 'GENRE', description: 'Conflictos emocionales y desarrollo profundo de los personajes.' },
  { name: 'Fantasía', slug: 'fantasia', category: 'GENRE', description: 'Mundos, magia y criaturas fuera de la realidad.' },
  { name: 'Acción', slug: 'accion', category: 'GENRE', description: 'Combates, persecuciones y secuencias de alta tensión.' },
  { name: 'Misterio', slug: 'misterio', category: 'GENRE', description: 'Enigmas e investigaciones que se resuelven a lo largo de la trama.' },
];

async function main() {
  let created = 0;
  let existed = 0;
  for (const g of REQUIRED_GENRES) {
    // Genero global: organizationId = null. Unico por (organizationId, slug).
    const found = await prisma.genre.findFirst({
      where: { slug: g.slug, organizationId: null },
    });
    if (found) {
      existed += 1;
      console.log(`  exists  ${g.slug}`);
      continue;
    }
    await prisma.genre.create({
      data: {
        name: g.name,
        slug: g.slug,
        description: g.description,
        category: g.category,
        nsfw: false,
        display: true,
        organizationId: null,
      },
    });
    created += 1;
    console.log(`  created ${g.slug}`);
  }
  console.log(`\nDone. created=${created} existed=${existed} total=${REQUIRED_GENRES.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
