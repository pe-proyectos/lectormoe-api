/**
 * End-to-end smoke test for the writings/novels flow.
 *
 * Targets the LIVE prod DB. Creates throwaway fixtures suffixed with the run
 * timestamp; cleanup is in a try/finally.
 *
 * Run: bun run src/scripts/test-writings-flow.ts
 *
 * Must run AFTER `bunx prisma db push && bunx prisma generate` so that the new
 * Chapter.bodyMarkdown column exists. Must also run AFTER seed-writing-book-types
 * so the 'novel' BookType row exists.
 */
import { prisma } from '../models/prisma';
import { getChapter } from '../controllers/chapter/get';
import { getMangaCustomBySlug } from '../controllers/manga-custom/get';
import { getFeaturedManga } from '../controllers/landing/featured-manga';

const ts = Date.now();
const SUFFIX = `wrtest-${ts}`;

let pass = 0;
let fail = 0;

const ok = (label: string) => { pass += 1; console.log(`  PASS  ${label}`); };
const ko = (label: string, err?: any) => { fail += 1; console.log(`  FAIL  ${label}${err ? `\n        ${err?.message ?? err}` : ''}`); };

interface Fixture {
  bookType: { id: number };
  demography: { id: number };
  user: { id: number };
  org: { id: number; slug: string };
  manga: { id: number; slug: string };
  mc: { id: number; slug: string };
  chapter: { id: number; number: number };
}

async function setup(): Promise<Fixture> {
  const bookType = await prisma.bookType.findUnique({ where: { code: 'novel' } });
  if (!bookType) throw new Error("Falta el BookType 'novel'. Corre seed-writing-book-types primero.");
  const demography = await prisma.demography.findFirst();
  if (!demography) throw new Error('No hay Demography en la DB');

  const user = await prisma.user.create({
    data: { username: `${SUFFIX}-u`, slug: `${SUFFIX}-u`, email: `${SUFFIX}-u@example.com`, password: 'noop' },
    select: { id: true },
  });

  const org = await prisma.organization.create({
    data: { name: `${SUFFIX}-org`, title: `${SUFFIX}-org`, domain: `${SUFFIX}.example.com`, slug: `${SUFFIX}-org`, isPublic: true, isNSFW: false, isDeleted: false },
    select: { id: true, slug: true },
  });

  await prisma.permission.create({
    data: { userId: user.id, organizationId: org.id, canEditMangaCustom: true, canCreateMangaCustom: true, canCreateChapter: true, canEditChapter: true, canSeeAdminPanel: true },
  });

  const manga = await prisma.manga.create({
    data: {
      title: `${SUFFIX} Novel`, slug: `${SUFFIX}-novel`,
      bookTypeId: bookType.id, demographyId: demography.id,
      // Need a non-null cover for landing endpoints to include it.
      imageUrl: 'https://example.com/cover.jpg',
    },
    select: { id: true, slug: true },
  });

  const mc = await prisma.mangaCustom.create({
    data: {
      mangaId: manga.id, organizationId: org.id, title: `${SUFFIX} MC`,
      imageUrl: 'https://example.com/cover.jpg', visibility: 'public',
      // Bump views so it ranks high in featured-manga during the test.
      views: 999999,
    },
    select: { id: true },
  });

  const slug = manga.slug;
  // mangaCustom doesn't have a slug; we use the underlying manga slug for routing.
  return {
    bookType: { id: bookType.id },
    demography: { id: demography.id },
    user, org, manga,
    mc: { id: mc.id, slug },
    chapter: { id: 0, number: 0 },
  };
}

async function teardown(fx: Fixture | null) {
  if (!fx) return;
  try {
    await prisma.viewsHistory.deleteMany({ where: { OR: [{ mangaCustomId: fx.mc.id }, { chapterId: fx.chapter.id || -1 }] } });
    await prisma.userChapterHistory.deleteMany({ where: { chapterId: fx.chapter.id || -1 } });
    await prisma.notification.deleteMany({ where: { mangaCustomId: fx.mc.id } });
    await prisma.chapter.deleteMany({ where: { mangaCustomId: fx.mc.id } });
    await prisma.mangaCustom.deleteMany({ where: { id: fx.mc.id } });
    await prisma.permission.deleteMany({ where: { userId: fx.user.id, organizationId: fx.org.id } });
    await prisma.manga.deleteMany({ where: { id: fx.manga.id } });
    await prisma.organization.deleteMany({ where: { id: fx.org.id } });
    await prisma.user.deleteMany({ where: { id: fx.user.id } });
    console.log('  cleanup ok');
  } catch (e: any) {
    console.error('  cleanup error:', e?.message);
  }
}

async function run() {
  let fx: Fixture | null = null;
  try {
    fx = await setup();
    ok('fixture setup');

    // 1. Create a chapter with bodyMarkdown.
    const chapter = await prisma.chapter.create({
      data: {
        mangaCustomId: fx.mc.id, number: 1, title: 'Capítulo de prueba',
        releasedAt: new Date(),
        bodyMarkdown: '# Hola\n\nEsto es **markdown**.',
      },
      select: { id: true, number: true, bodyMarkdown: true },
    });
    fx.chapter = { id: chapter.id, number: chapter.number };
    if (chapter.bodyMarkdown && chapter.bodyMarkdown.includes('**markdown**')) ok('chapter created with bodyMarkdown');
    else ko('chapter created with bodyMarkdown', `got: ${chapter.bodyMarkdown}`);

    // 2. getChapter returns bodyMarkdown.
    const got = await getChapter(fx.org.id, fx.manga.slug, 1);
    if (got && (got as any).bodyMarkdown && (got as any).bodyMarkdown.includes('**markdown**')) ok('getChapter returns bodyMarkdown');
    else ko('getChapter returns bodyMarkdown', `got: ${JSON.stringify(got).slice(0, 200)}`);

    // 3. getMangaCustomBySlug includes the chapter (and chapter.bodyMarkdown by virtue of include w/o select).
    const mc = await getMangaCustomBySlug(fx.org.id, fx.manga.slug);
    const ch = (mc as any)?.chapters?.find((c: any) => c.number === 1);
    if (ch && ch.bodyMarkdown && ch.bodyMarkdown.includes('**markdown**')) ok('getMangaCustomBySlug exposes bodyMarkdown');
    else ko('getMangaCustomBySlug exposes bodyMarkdown', `got: ${JSON.stringify(ch).slice(0, 200)}`);

    // 4. featured-manga with contentKind=writing should include this novel.
    const featuredWriting = await getFeaturedManga(50, false, 'writing');
    const found = featuredWriting.find((m: any) => m.id === fx!.mc.id.toString());
    if (found) ok('featured-manga contentKind=writing includes the novel');
    else ko('featured-manga contentKind=writing includes the novel', `not found in ${featuredWriting.length} results`);

    // 5. featured-manga with contentKind=manga should NOT include this novel.
    const featuredManga = await getFeaturedManga(50, false, 'manga');
    const notFound = !featuredManga.find((m: any) => m.id === fx!.mc.id.toString());
    if (notFound) ok('featured-manga contentKind=manga excludes the novel');
    else ko('featured-manga contentKind=manga excludes the novel', `unexpectedly found`);
  } catch (e: any) {
    ko('fixture setup or main flow', e);
  } finally {
    await teardown(fx);
  }
}

await run();
console.log(`\nResults: pass=${pass} fail=${fail}`);
process.exit(fail === 0 ? 0 : 1);
