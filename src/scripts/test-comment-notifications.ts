/**
 * End-to-end test for the comment notification fan-out.
 *
 * Targets the LIVE prod DB. Creates throwaway fixtures suffixed with the run
 * timestamp, exercises the new notifyComment service, and asserts the resulting
 * Notification rows. try/finally guarantees teardown.
 *
 * Run AFTER `bunx prisma db push && bunx prisma generate` so the new
 * notifyCommentsOnOwnedContent column exists on the User model.
 *
 *   bun run src/scripts/test-comment-notifications.ts
 */
import { prisma } from '../models/prisma';
import { notifyComment } from '../services/notify-new-chapter';

const ts = Date.now();
const SUFFIX = `test-cmt-${ts}`;

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
  org: { id: number; slug: string };
  manga: { id: number; slug: string };
  mc: { id: number };
  commenter: { id: number };
  ownerA: { id: number };
  thirdParty: { id: number };
}

async function setup(): Promise<Fixture> {
  const bookType = await prisma.bookType.findFirst();
  if (!bookType) throw new Error('No hay BookType en la DB');
  const demography = await prisma.demography.findFirst();
  if (!demography) throw new Error('No hay Demography en la DB');

  const org = await prisma.organization.create({
    data: {
      name: `${SUFFIX}-org`,
      title: `${SUFFIX}-org`,
      domain: `${SUFFIX}.example.com`,
      slug: `${SUFFIX}-org`,
    },
    select: { id: true, slug: true },
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

  const mc = await prisma.mangaCustom.create({
    data: { mangaId: manga.id, organizationId: org.id, title: `MC ${SUFFIX}` },
    select: { id: true },
  });

  const mkUser = (label: string) => prisma.user.create({
    data: {
      username: `${SUFFIX}-${label}`,
      slug: `${SUFFIX}-${label}`,
      email: `${SUFFIX}-${label}@example.com`,
      password: 'noop',
    },
    select: { id: true },
  });

  const commenter = await mkUser('commenter');
  const ownerA = await mkUser('ownerA');
  const thirdParty = await mkUser('thirdParty');

  // ownerA owns the org's content via canSeeAdminPanel.
  await prisma.permission.create({
    data: { userId: ownerA.id, organizationId: org.id, canSeeAdminPanel: true },
  });
  // thirdParty is a regular user with no admin permission.
  await prisma.permission.create({
    data: { userId: thirdParty.id, organizationId: org.id, role: 'user' },
  });

  return { org, manga, mc, commenter, ownerA, thirdParty };
}

async function teardown(fx: Fixture | null) {
  if (!fx) return;
  try {
    const userIds = [fx.commenter.id, fx.ownerA.id, fx.thirdParty.id];
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.comment.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.permission.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.mangaCustom.deleteMany({ where: { mangaId: fx.manga.id } });
    await prisma.manga.delete({ where: { id: fx.manga.id } }).catch(() => {});
    await prisma.organization.delete({ where: { id: fx.org.id } }).catch(() => {});
    for (const id of userIds) {
      await prisma.user.delete({ where: { id } }).catch(() => {});
    }
  } catch (e) {
    console.error('teardown error (continuing):', e);
  }
}

async function main() {
  console.log(`\n=== test-comment-notifications  ${SUFFIX} ===\n`);
  let fx: Fixture | null = null;
  try {
    fx = await step('setup fixture', setup);
    if (!fx) throw new Error('Setup failed');

    // 1) Top-level comment by commenter on the manga.
    const topComment = await step('create top-level comment', async () => {
      return prisma.comment.create({
        data: {
          userId: fx!.commenter.id,
          organizationId: fx!.org.id,
          identifier: fx!.manga.slug,
          comment: `Top-level by commenter ${SUFFIX}`,
        },
      });
    });
    if (!topComment) throw new Error('top-level create failed');

    await step('notifyComment(top-level)', async () => {
      await notifyComment(topComment.id);
    });

    await step('owner-A receives comment_on_owned_content with emailSentAt set', async () => {
      const n = await prisma.notification.findFirst({
        where: { userId: fx!.ownerA.id, commentId: topComment.id, type: 'comment_on_owned_content' },
      });
      if (!n) throw new Error('expected notification missing');
      if (!n.emailSentAt) throw new Error('emailSentAt should be set (in-app only)');
    });

    await step('commenter receives no notification for their own top-level comment', async () => {
      const n = await prisma.notification.findFirst({
        where: { userId: fx!.commenter.id, commentId: topComment.id },
      });
      if (n) throw new Error('commenter should not be notified about their own comment');
    });

    await step('third-party receives no notification (not an owner)', async () => {
      const n = await prisma.notification.findFirst({
        where: { userId: fx!.thirdParty.id, commentId: topComment.id },
      });
      if (n) throw new Error('third-party is not an owner');
    });

    // 2) Reply by third-party to commenter's comment.
    const reply = await step('create reply by third-party to commenter', async () => {
      return prisma.comment.create({
        data: {
          userId: fx!.thirdParty.id,
          organizationId: fx!.org.id,
          identifier: fx!.manga.slug,
          parentId: topComment.id,
          comment: `Reply by third-party ${SUFFIX}`,
        },
      });
    });
    if (!reply) throw new Error('reply create failed');

    await step('notifyComment(reply)', async () => {
      await notifyComment(reply.id);
    });

    await step('commenter receives comment_reply with emailSentAt = null (cron will email)', async () => {
      const n = await prisma.notification.findFirst({
        where: { userId: fx!.commenter.id, commentId: reply.id, type: 'comment_reply' },
      });
      if (!n) throw new Error('expected reply notification missing');
      if (n.emailSentAt) throw new Error(`emailSentAt should be null for comment_reply, got ${n.emailSentAt}`);
    });

    await step('owner-A receives comment_on_owned_content for the reply too', async () => {
      const n = await prisma.notification.findFirst({
        where: { userId: fx!.ownerA.id, commentId: reply.id, type: 'comment_on_owned_content' },
      });
      if (!n) throw new Error('expected owner notification missing');
      if (!n.emailSentAt) throw new Error('emailSentAt should be set');
    });

    await step('commenter does NOT receive a duplicate comment_on_owned_content for the reply', async () => {
      // commenter is the parent author and already gets the reply notification;
      // they should not also get an owned-content notification for the same comment.
      const n = await prisma.notification.findFirst({
        where: { userId: fx!.commenter.id, commentId: reply.id, type: 'comment_on_owned_content' },
      });
      if (n) throw new Error('commenter should not get owned-content notification when also receiving reply');
    });

    // 3) Opt-out: owner-A turns off notifyCommentsOnOwnedContent.
    await step('flip owner-A.notifyCommentsOnOwnedContent = false', async () => {
      await prisma.user.update({
        where: { id: fx!.ownerA.id },
        data: { notifyCommentsOnOwnedContent: false },
      });
    });

    const optOutComment = await step('create another top-level comment', async () => {
      return prisma.comment.create({
        data: {
          userId: fx!.commenter.id,
          organizationId: fx!.org.id,
          identifier: fx!.manga.slug,
          comment: `Opt-out test ${SUFFIX}`,
        },
      });
    });
    if (!optOutComment) throw new Error('opt-out comment create failed');

    await step('notifyComment(opt-out)', async () => {
      await notifyComment(optOutComment.id);
    });

    await step('owner-A receives NO comment_on_owned_content notification (opted out)', async () => {
      const n = await prisma.notification.findFirst({
        where: { userId: fx!.ownerA.id, commentId: optOutComment.id, type: 'comment_on_owned_content' },
      });
      if (n) throw new Error('opted-out owner should not receive notification');
    });

  } finally {
    await teardown(fx);
    console.log(`\n=== Summary: ${pass} pass / ${fail} fail ===\n`);
    process.exit(fail > 0 ? 1 : 0);
  }
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(2);
});
