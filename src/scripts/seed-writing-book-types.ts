/**
 * Idempotently insert the BookType rows used by the writings/novels surface.
 * Safe to re-run: any existing code is left untouched.
 *
 * Run: bun run src/scripts/seed-writing-book-types.ts
 */
import { prisma } from '../models/prisma';

const REQUIRED_BOOK_TYPES = [
  { code: 'manga', name: 'Manga', default_read_type: 'rtl' },
  { code: 'manhwa', name: 'Manhwa', default_read_type: 'vertical' },
  { code: 'manhua', name: 'Manhua', default_read_type: 'rtl' },
  { code: 'novel', name: 'Novela', default_read_type: 'text' },
  { code: 'light-novel', name: 'Novela Ligera', default_read_type: 'text' },
  { code: 'book', name: 'Libro', default_read_type: 'text' },
  { code: 'short-story', name: 'Cuento', default_read_type: 'text' },
];

async function main() {
  let created = 0;
  let existed = 0;
  for (const bt of REQUIRED_BOOK_TYPES) {
    const found = await prisma.bookType.findUnique({ where: { code: bt.code } });
    if (found) {
      existed += 1;
      console.log(`  exists  ${bt.code}`);
      continue;
    }
    await prisma.bookType.create({ data: bt });
    created += 1;
    console.log(`  created ${bt.code}`);
  }
  console.log(`\nDone. created=${created} existed=${existed} total=${REQUIRED_BOOK_TYPES.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
