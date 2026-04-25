/**
 * End-to-end smoke test for the new joint refactor.
 *
 * This script targets the LIVE prod DB (uses `import { prisma } from '../models/prisma'`).
 * It creates throwaway test fixtures suffixed with the run timestamp so re-runs
 * are idempotent and don't collide. A try/finally guarantees cleanup even on
 * failure.
 *
 * Run: bun run src/scripts/test-joint-flows.ts
 *
 * IMPORTANT: This script must be run AFTER `bunx prisma db push && bunx prisma generate`,
 * because some flows reference the `LEFT` enum value and the new `JointMemberHistory`
 * model. Before migration, expect the following 5 steps to FAIL with schema errors:
 *   - invite Org B as UPLOADER          (prisma.jointMemberHistory.create missing)
 *   - Org B accepts invitation          (same)
 *   - Org B leaves joint                ("LEFT" not a valid JointMemberStatus)
 *   - re-invite + accept Org B          (cascading from leave failure)
 *   - A deletes joint                   (jointMemberHistory.create missing)
 * All other steps should PASS.
 */
import { prisma } from '../models/prisma';
import { createJoint } from '../controllers/joint/create';
import { inviteToJoint } from '../controllers/joint/invite';
import { respondToJointInvite } from '../controllers/joint/respond';
import { getJoint, getJointForAdmin } from '../controllers/joint/get';
import { promoteChapterToJoint } from '../controllers/joint/chapter/promote';
import { demoteChapterFromJoint } from '../controllers/joint/chapter/demote';
import { bulkMoveJointChapters } from '../controllers/joint/chapter/bulk-move';
import { transferChapterAuthorship } from '../controllers/joint/chapter/transfer-authorship';
import { leaveJoint } from '../controllers/joint/leave';
import { deleteJoint } from '../controllers/joint/delete';
import { deleteMangaCustom } from '../controllers/manga-custom/delete';

const ts = Date.now();
const SUFFIX = `test-joint-${ts}`;

let pass = 0;
let fail = 0;

const ok = (label: string) => { pass += 1; console.log(`  PASS  ${label}`); };
const ko = (label: string, err?: any) => { fail += 1; console.log(`  FAIL  ${label}${err ? `\n        ${err?.message ?? err}` : ''}`); };

async function step<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    const r = await fn();
    ok(label);
    return r;
  } catch (e: any) {
    ko(label, e);
    return null;
  }
}

interface Fixture {
  manga: { id: number; slug: string };
  bookTypeId: number;
  demographyId: number;
  testUser: { id: number };
  orgA: { id: number; slug: string };
  orgB: { id: number; slug: string };
  mcA?: { id: number };
  mcB?: { id: number };
  chaptersA: number[];
  chaptersB: number[];
  joint?: { id: number; slug: string };
}

async function setupFixture(): Promise<Fixture> {
  const bookType = await prisma.bookType.findFirst();
  if (!bookType) throw new Error('No hay BookType en la DB');
  const demography = await prisma.demography.findFirst();
  if (!demography) throw new Error('No hay Demography en la DB');

  const testUser = await prisma.user.create({
    data: {
      username: `${SUFFIX}-user`,
      slug: `${SUFFIX}-user`,
      email: `${SUFFIX}-user@example.com`,
      password: 'noop',
    },
    select: { id: true },
  });

  const manga = await prisma.manga.create({
    data: {
      title: `Test Manga ${SUFFIX}`,
      slug: `${SUFFIX}-manga`,
      bookTypeId: bookType.id,
      demographyId: demography.id,
    },
    select: { id: true, slug: true },
  });

  const orgA = await prisma.organization.create({
    data: {
      name: `${SUFFIX}-A`, title: `${SUFFIX}-A`,
      domain: `${SUFFIX}-a.example.com`, slug: `${SUFFIX}-a`,
    },
    select: { id: true, slug: true },
  });
  const orgB = await prisma.organization.create({
    data: {
      name: `${SUFFIX}-B`, title: `${SUFFIX}-B`,
      domain: `${SUFFIX}-b.example.com`, slug: `${SUFFIX}-b`,
    },
    select: { id: true, slug: true },
  });

  // Permissions for the test user in both orgs (so callers that check
  // canEditMangaCustom etc. don't reject).
  await prisma.permission.create({
    data: { userId: testUser.id, organizationId: orgA.id, canEditMangaCustom: true, canCreateMangaCustom: true },
  });
  await prisma.permission.create({
    data: { userId: testUser.id, organizationId: orgB.id, canEditMangaCustom: true, canCreateMangaCustom: true },
  });

  const mcA = await prisma.mangaCustom.create({
    data: {
      mangaId: manga.id, organizationId: orgA.id,
      title: `MC-A ${SUFFIX}`,
    },
    select: { id: true },
  });
  const mcB = await prisma.mangaCustom.create({
    data: {
      mangaId: manga.id, organizationId: orgB.id,
      title: `MC-B ${SUFFIX}`,
    },
    select: { id: true },
  });

  // Pre-existing solo chapters: A has #1, #2; B has #3.
  const chA1 = await prisma.chapter.create({ data: { mangaCustomId: mcA.id, uploadedByOrganizationId: orgA.id, number: 1, title: 'A1', releasedAt: new Date(), }, select: { id: true } });
  const chA2 = await prisma.chapter.create({ data: { mangaCustomId: mcA.id, uploadedByOrganizationId: orgA.id, number: 2, title: 'A2', releasedAt: new Date(), }, select: { id: true } });
  const chB3 = await prisma.chapter.create({ data: { mangaCustomId: mcB.id, uploadedByOrganizationId: orgB.id, number: 3, title: 'B3', releasedAt: new Date(), }, select: { id: true } });

  return {
    manga, bookTypeId: bookType.id, demographyId: demography.id,
    testUser, orgA, orgB, mcA, mcB,
    chaptersA: [chA1.id, chA2.id], chaptersB: [chB3.id],
  };
}

async function teardown(fx: Fixture | null) {
  if (!fx) return;
  try {
    // Order matters because of FK constraints. Hard-delete: chapters → MCs → joint → orgs/users/manga.
    if (fx.joint) {
      // jointMemberHistory may not exist in older generated client; tolerate missing.
      try { await (prisma as any).jointMemberHistory?.deleteMany?.({ where: { jointId: fx.joint.id } }); } catch {}
      await prisma.jointMember.deleteMany({ where: { jointId: fx.joint.id } });
    }
    // All chapters that ever pointed at this manga via either anchor.
    const allChapters = await prisma.chapter.findMany({
      where: {
        OR: [
          { mangaCustom: { mangaId: fx.manga.id } },
          fx.joint ? { jointId: fx.joint.id } : { id: -1 },
        ],
      },
      select: { id: true },
    });
    const chapterIds = allChapters.map(c => c.id);
    if (chapterIds.length > 0) {
      await prisma.userChapterHistory.deleteMany({ where: { chapterId: { in: chapterIds } } });
      await prisma.viewsHistory.deleteMany({ where: { chapterId: { in: chapterIds } } });
      await prisma.page.deleteMany({ where: { chapterId: { in: chapterIds } } });
      await prisma.notification.deleteMany({ where: { chapterId: { in: chapterIds } } });
      await prisma.chapter.deleteMany({ where: { id: { in: chapterIds } } });
    }
    const mcs = await prisma.mangaCustom.findMany({ where: { mangaId: fx.manga.id }, select: { id: true } });
    const mcIds = mcs.map(m => m.id);
    if (mcIds.length > 0) {
      await prisma.notification.deleteMany({ where: { mangaCustomId: { in: mcIds } } });
      await prisma.viewsHistory.deleteMany({ where: { mangaCustomId: { in: mcIds } } });
    }
    if (fx.joint) {
      await prisma.notification.deleteMany({ where: { jointId: fx.joint.id } });
      await prisma.viewsHistory.deleteMany({ where: { jointId: fx.joint.id } });
    }
    await prisma.mangaCustom.deleteMany({ where: { mangaId: fx.manga.id } });
    if (fx.joint) await prisma.mangaJoint.delete({ where: { id: fx.joint.id } }).catch(() => {});
    await prisma.audit.deleteMany({ where: { OR: [{ organizationId: fx.orgA.id }, { organizationId: fx.orgB.id }] } });
    await prisma.permission.deleteMany({ where: { userId: fx.testUser.id } });
    await prisma.organization.deleteMany({ where: { id: { in: [fx.orgA.id, fx.orgB.id] } } });
    await prisma.manga.delete({ where: { id: fx.manga.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: fx.testUser.id } }).catch(() => {});
  } catch (e) {
    console.error('teardown error (continuing):', e);
  }
}

async function main() {
  console.log(`\n=== test-joint-flows  ${SUFFIX} ===\n`);
  let fx: Fixture | null = null;
  try {
    fx = await step('setup fixture', setupFixture);
    if (!fx) throw new Error('Setup failed; aborting.');

    const joint = await step('create joint with Org A as LEADER', async () => {
      return createJoint(fx!.orgA.id, { mangaSlug: fx!.manga.slug });
    });
    if (!joint) throw new Error('createJoint failed; aborting.');
    fx.joint = { id: (joint as any).id, slug: (joint as any).slug };

    await step('invite Org B as UPLOADER', async () => {
      return inviteToJoint(fx!.joint!.slug, fx!.orgA.id, { organizationSlug: fx!.orgB.slug, role: 'UPLOADER' }, fx!.testUser.id);
    });

    await step('Org B accepts invitation', async () => {
      return respondToJointInvite(fx!.joint!.slug, fx!.orgB.id, { accept: true }, fx!.testUser.id);
    });

    // Aggregation: getJoint chapter list should include solo caps from both A and B.
    await step('UNION shows pre-existing solo chapters', async () => {
      const j = await getJoint(fx!.joint!.slug);
      const numbers = (j.chapters as any[]).map(c => c.number).sort((a, b) => a - b);
      const expected = [1, 2, 3];
      const matches = JSON.stringify(numbers) === JSON.stringify(expected);
      if (!matches) throw new Error(`numbers=${JSON.stringify(numbers)} expected=${JSON.stringify(expected)}`);
    });

    // Promote chapter #1 (A's) to joint
    await step('promote A.#1 to joint', async () => {
      await promoteChapterToJoint(fx!.joint!.slug, fx!.orgA.id, fx!.chaptersA[0], fx!.testUser.id);
      const ch = await prisma.chapter.findUnique({ where: { id: fx!.chaptersA[0] }, select: { jointId: true, mangaCustomId: true } });
      if (!ch || ch.jointId !== fx!.joint!.id || ch.mangaCustomId !== null) {
        throw new Error(`promote did not transition (jointId=${ch?.jointId} mc=${ch?.mangaCustomId})`);
      }
    });

    // Demote it back
    await step('demote A.#1 back to solo (no conflict)', async () => {
      const r = await demoteChapterFromJoint(fx!.joint!.slug, fx!.orgA.id, fx!.chaptersA[0], { actorUserId: fx!.testUser.id });
      if (!r.success) throw new Error('demote returned not success');
      const ch = await prisma.chapter.findUnique({ where: { id: fx!.chaptersA[0] }, select: { jointId: true, mangaCustomId: true } });
      if (!ch || ch.jointId !== null || !ch.mangaCustomId) throw new Error(`demote did not transition (jointId=${ch?.jointId} mc=${ch?.mangaCustomId})`);
    });

    // Bulk move (skip-and-report). Promote A.#1 and a non-existent id together.
    await step('bulk-move skip-and-report', async () => {
      const r = await bulkMoveJointChapters(fx!.joint!.slug, fx!.orgA.id, [fx!.chaptersA[0], 99999999], 'promote', { actorUserId: fx!.testUser.id });
      if (r.moved !== 1) throw new Error(`expected moved=1 got ${r.moved}`);
      if (r.skipped.length !== 1) throw new Error(`expected skipped=1 got ${r.skipped.length}`);
    });

    // transfer-authorship: A.#1 (now in joint) → org B
    await step('transfer authorship of A.#1 from A → B', async () => {
      await transferChapterAuthorship(fx!.joint!.slug, fx!.orgA.id, fx!.chaptersA[0], fx!.orgB.id, fx!.testUser.id);
      const ch = await prisma.chapter.findUnique({ where: { id: fx!.chaptersA[0] }, select: { uploadedByOrganizationId: true } });
      if (ch?.uploadedByOrganizationId !== fx!.orgB.id) throw new Error(`uploader is ${ch?.uploadedByOrganizationId}, expected ${fx!.orgB.id}`);
    });

    // Transfer it back (so leave-flow assertions stay clean)
    await step('transfer authorship back to A', async () => {
      // Now caller must be the new uploader (B) or LEADER (A). Use A as LEADER override.
      await transferChapterAuthorship(fx!.joint!.slug, fx!.orgA.id, fx!.chaptersA[0], fx!.orgA.id, fx!.testUser.id);
      const ch = await prisma.chapter.findUnique({ where: { id: fx!.chaptersA[0] }, select: { uploadedByOrganizationId: true } });
      if (ch?.uploadedByOrganizationId !== fx!.orgA.id) throw new Error(`uploader=${ch?.uploadedByOrganizationId} expected ${fx!.orgA.id}`);
    });

    // Block delete MangaCustom while in active joint
    await step('block delete MangaCustom while in active joint', async () => {
      let threw = false;
      try {
        await deleteMangaCustom(fx!.orgB.id, fx!.manga.slug);
      } catch (e: any) {
        threw = true;
        if (!String(e?.message ?? '').includes('joint activo')) throw new Error(`unexpected error: ${e?.message}`);
      }
      if (!threw) throw new Error('deleteMangaCustom should have thrown but did not');
    });

    // Leave joint as Org B → expect Org B's joint chapters detach back to its MC.
    // First push B's chapter into the joint so we can assert detach moved it back.
    await step('promote B.#3 to joint (setup for leave)', async () => {
      await promoteChapterToJoint(fx!.joint!.slug, fx!.orgB.id, fx!.chaptersB[0], fx!.testUser.id);
    });
    await step('Org B leaves joint → joint chapters detach back to its MC', async () => {
      const r = await leaveJoint(fx!.joint!.slug, fx!.orgB.id, fx!.testUser.id);
      const ch = await prisma.chapter.findUnique({ where: { id: fx!.chaptersB[0] }, select: { jointId: true, mangaCustomId: true } });
      if (!ch || ch.jointId !== null || !ch.mangaCustomId) throw new Error(`leave did not detach: ch=${JSON.stringify(ch)} (moved=${r.moved})`);
      const member = await prisma.jointMember.findFirst({ where: { jointId: fx!.joint!.id, organizationId: fx!.orgB.id } });
      if ((member?.status as any) !== 'LEFT') throw new Error(`B status is ${member?.status}, expected LEFT`);
    });

    // Re-invite + accept Org B; aggregation should pick up B's solo chapters.
    await step('re-invite + accept Org B', async () => {
      await inviteToJoint(fx!.joint!.slug, fx!.orgA.id, { organizationSlug: fx!.orgB.slug, role: 'UPLOADER' }, fx!.testUser.id);
      await respondToJointInvite(fx!.joint!.slug, fx!.orgB.id, { accept: true }, fx!.testUser.id);
      const j = await getJoint(fx!.joint!.slug);
      const numbers = (j.chapters as any[]).map(c => c.number).sort((a, b) => a - b);
      if (!numbers.includes(3)) throw new Error(`re-aggregation missing #3: ${JSON.stringify(numbers)}`);
    });

    // Delete joint as A → all chapters detached, joint soft-deleted.
    await step('A deletes joint → all chapters detached, joint soft-deleted', async () => {
      await deleteJoint(fx!.joint!.slug, fx!.orgA.id, fx!.testUser.id);
      const j = await prisma.mangaJoint.findUnique({ where: { id: fx!.joint!.id }, select: { deletedAt: true } });
      if (!j?.deletedAt) throw new Error('joint not soft-deleted');
      // No chapters should still have jointId set + active.
      const stillJoint = await prisma.chapter.count({ where: { jointId: fx!.joint!.id, deletedAt: null } });
      if (stillJoint !== 0) throw new Error(`${stillJoint} chapters still in joint`);
    });
  } catch (e: any) {
    console.error('UNEXPECTED top-level failure:', e);
    fail += 1;
  } finally {
    await teardown(fx);
  }

  console.log(`\n=== ${pass} PASS, ${fail} FAIL ===\n`);
  await prisma.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
