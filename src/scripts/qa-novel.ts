/**
 * QA: crea una novela de prueba en una org existente, imprime las URLs.
 * Luego correr con --cleanup para borrarla.
 *
 *   bun run src/scripts/qa-novel.ts          # create
 *   bun run src/scripts/qa-novel.ts --cleanup
 */
import { prisma } from '../models/prisma';

const ORG_SLUG = 'scanshub';
const MANGA_SLUG = 'qa-novela-prueba-temporal';
const TITLE = 'QA - Novela de prueba (temporal)';

const SAMPLE_MD = `# Capítulo 1 — La biblioteca infinita

En aquel **viejo barrio**, donde las farolas titilaban con la indecisión de los recuerdos, vivía una mujer cuyo nombre nadie podía pronunciar dos veces igual.

> "El silencio también es una forma de hablar," solía decir, mirando la lluvia caer sobre los tejados de pizarra.

## Una noche distinta

Aquella noche, sin embargo, *algo se movía* en la biblioteca del piso superior. Las páginas de un libro abierto pasaban solas, una tras otra, y un olor a tinta antigua se escapaba por debajo de la puerta.

Las cosas que descubrió esa noche:

- Un mapa con tres marcas en rojo
- Una carta sellada con cera negra
- Una llave que no abría ninguna puerta visible

### El amanecer

Al amanecer, comprendió que **nada** volvería a ser igual. Bajó las escaleras [con paso firme](https://example.com), dispuesta a enfrentar lo que viniera.

---

*Continuará en el próximo capítulo...*
`;

async function cleanup() {
  const m = await prisma.manga.findUnique({ where: { slug: MANGA_SLUG }, select: { id: true } });
  if (!m) { console.log('Nothing to clean.'); return; }
  await prisma.chapter.deleteMany({ where: { mangaCustom: { mangaId: m.id } } });
  await prisma.mangaCustom.deleteMany({ where: { mangaId: m.id } });
  await prisma.manga.delete({ where: { id: m.id } });
  console.log('Cleaned up.');
}

async function create() {
  const org = await prisma.organization.findUnique({ where: { slug: ORG_SLUG }, select: { id: true } });
  if (!org) throw new Error(`org ${ORG_SLUG} not found`);

  const novelType = await prisma.bookType.findFirst({ where: { code: 'novel' }, select: { id: true } });
  if (!novelType) throw new Error('BookType novel not found');

  const manga = await prisma.manga.create({
    data: {
      title: TITLE,
      slug: MANGA_SLUG,
      bookType: { connect: { id: novelType.id } },
      demography: { connect: { id: 1 } },
      shortDescription: 'Novela de prueba para QA del lector. Borrar después.',
      imageUrl: 'https://r2.capibaratraductor.com/static/placeholder-novel.jpg',
    },
  });

  const mc = await prisma.mangaCustom.create({
    data: {
      mangaId: manga.id,
      organizationId: org.id,
      title: TITLE,
      shortDescription: 'Novela de prueba para QA del lector. Borrar después.',
      imageUrl: 'https://r2.capibaratraductor.com/static/placeholder-novel.jpg',
      status: 'ongoing',
      visibility: 'public',
      workType: 'manga',
    },
  });

  await prisma.chapter.create({
    data: {
      mangaCustomId: mc.id,
      number: 1,
      title: 'La biblioteca infinita',
      bodyMarkdown: SAMPLE_MD,
      releasedAt: new Date(),
    },
  });

  console.log(`Created. URLs to QA:`);
  console.log(`  detail:  https://capibaratraductor.com/writings/${ORG_SLUG}/novel/${MANGA_SLUG}`);
  console.log(`  reader:  https://capibaratraductor.com/writings/${ORG_SLUG}/novel/${MANGA_SLUG}/chapter/1`);
}

(async () => {
  if (process.argv.includes('--cleanup')) await cleanup();
  else await create();
})().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
