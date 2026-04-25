import { Elysia, t } from 'elysia';
import { prisma } from '../../models/prisma';
import { loggedUserOnly } from '../../plugins/auth';
import { useOrganizationOptional } from '../../plugins/organization';
import { CreateJointRequest } from '../../types/joint/create';
import { EditJointRequest } from '../../types/joint/edit';
import { InviteToJointRequest } from '../../types/joint/invite';
import { RespondToJointRequest } from '../../types/joint/respond';
import { TransferJointRequest } from '../../types/joint/transfer';
import { UpdateJointMemberPermissionsRequest } from '../../types/joint/permissions';
import { CreateJointChapterRequest } from '../../types/joint/chapter/create';
import { EditJointChapterRequest } from '../../types/joint/chapter/edit';
import { BulkMoveJointChaptersRequest, TransferAuthorshipRequest } from '../../types/joint/chapter/move';
import { requireJointMember } from '../../util/joint-auth';
import { createJoint } from '../../controllers/joint/create';
import { getJoint, getJointForAdmin } from '../../controllers/joint/get';
import { editJoint } from '../../controllers/joint/edit';
import { deleteJoint } from '../../controllers/joint/delete';
import { listJointsForOrg } from '../../controllers/joint/list';
import { inviteToJoint } from '../../controllers/joint/invite';
import { respondToJointInvite } from '../../controllers/joint/respond';
import { expelFromJoint } from '../../controllers/joint/expel';
import { transferJointLeadership } from '../../controllers/joint/transfer';
import { updateJointMemberPermissions } from '../../controllers/joint/member-permissions';
import { createJointChapter } from '../../controllers/joint/chapter/create';
import { getJointChapter } from '../../controllers/joint/chapter/get';
import { editJointChapter } from '../../controllers/joint/chapter/edit';
import { deleteJointChapter } from '../../controllers/joint/chapter/delete';
import { leaveJoint } from '../../controllers/joint/leave';
import { promoteChapterToJoint } from '../../controllers/joint/chapter/promote';
import { demoteChapterFromJoint } from '../../controllers/joint/chapter/demote';
import { bulkMoveJointChapters } from '../../controllers/joint/chapter/bulk-move';
import { transferChapterAuthorship } from '../../controllers/joint/chapter/transfer-authorship';
import { saveJointFavorite } from '../../controllers/favorites/save-joint';
import { deleteJointFavorite } from '../../controllers/favorites/delete-joint';
import { getJointFavorite } from '../../controllers/favorites/get-joint';

export const router = () => new Elysia()
  // ─── PUBLIC ROUTES ──────────────────────────────────────────────────────────
  .get('/api/joint/list', async ({ query }) => {
    const page = parseInt((query as any).page || '1');
    const limit = parseInt((query as any).limit || '20');
    const skip = (page - 1) * limit;

    const [joints, total] = await Promise.all([
      prisma.mangaJoint.findMany({
        where: { deletedAt: null },
        include: {
          manga: { select: { title: true, slug: true } },
          members: {
            where: { status: 'ACCEPTED' },
            select: {
              role: true,
              organization: { select: { id: true, name: true, slug: true, logoUrl: true } },
            },
          },
          chapters: {
            where: { deletedAt: null },
            select: { id: true, number: true, releasedAt: true },
            orderBy: { number: 'desc' },
            take: 2,
          },
        },
        orderBy: { lastChapterAt: { sort: 'desc', nulls: 'last' } },
        skip,
        take: limit,
      }),
      prisma.mangaJoint.count({ where: { deletedAt: null } }),
    ]);

    return {
      status: true,
      data: joints,
      total,
      maxPage: Math.ceil(total / limit),
    };
  }, {
    response: t.Object({ status: t.Boolean(), data: t.Any(), total: t.Number(), maxPage: t.Number() }),
  })

  .get('/api/joint/:slug', async ({ params: { slug } }) => {
    const data = await getJoint(slug);
    return { status: true, data };
  }, { response: t.Object({ status: t.Boolean(), data: t.Any() }) })

  // Look up the active joint for a base manga (if any). Returns null when no active joint exists.
  // Used by the manga admin edit UI to show a banner and prevent chapter uploads that would bypass the joint.
  .get('/api/manga/:mangaSlug/joint', async ({ params: { mangaSlug } }) => {
    const joint = await prisma.mangaJoint.findFirst({
      where: { deletedAt: null, manga: { slug: mangaSlug } },
      select: { id: true, slug: true, title: true },
    });
    return { status: true, data: joint };
  }, { response: t.Object({ status: t.Boolean(), data: t.Any() }) })

  .get('/api/joint/:slug/chapter/:number', async ({ params: { slug, number } }) => {
    const data = await getJointChapter(slug, parseFloat(number));
    return { status: true, data };
  }, { response: t.Object({ status: t.Boolean(), data: t.Any() }) })

  // Public pages endpoint — joint chapters have no subscription gating, so no org context needed.
  .get('/api/joint/:slug/chapter/:number/pages', async ({ params: { slug, number } }) => {
    const chapterNumber = parseFloat(number);
    const joint = await prisma.mangaJoint.findFirst({
      where: { slug, deletedAt: null },
      select: { id: true },
    });
    if (!joint) throw new Error('Joint no encontrado.');
    const chapter = await prisma.chapter.findFirst({
      where: { jointId: joint.id, number: chapterNumber, deletedAt: null },
      include: { pages: { orderBy: { number: 'asc' } } },
    });
    if (!chapter) throw new Error('Capítulo no encontrado.');
    return { status: true, data: chapter.pages };
  }, { response: t.Object({ status: t.Boolean(), data: t.Any() }) })

  // ─── AUTHENTICATED ROUTES ────────────────────────────────────────────────────
  .use(loggedUserOnly())
  .use(useOrganizationOptional())

  // List joints for caller's org
  .get('/api/joint', async ({ organizationId }) => {
    if (!organizationId) throw new Error('Se requiere contexto de organización.');
    const data = await listJointsForOrg(organizationId);
    return { status: true, data };
  }, { response: t.Object({ status: t.Boolean(), data: t.Any() }) })

  // Get joint for admin (includes all member statuses)
  .get('/api/joint/:slug/admin', async ({ params: { slug }, organizationId }) => {
    if (!organizationId) throw new Error('Se requiere contexto de organización.');
    const { member } = await requireJointMember(slug, organizationId);
    // Only leaders/canEditJoint see the full list including non-accepted members
    // Regular accepted members only see the public view
    if (member.role !== 'LEADER' && !member.canEditJoint) {
      const data = await getJoint(slug);
      return { status: true, data };
    }
    const data = await getJointForAdmin(slug);
    return { status: true, data };
  }, { response: t.Object({ status: t.Boolean(), data: t.Any() }) })

  // Create joint
  .post('/api/joint', async ({ organizationId, user, body }) => {
    if (!organizationId) throw new Error('Se requiere contexto de organización.');
    const permissions = user.permissions.find((p: any) => p.organizationId === organizationId);
    if (!permissions?.canEditMangaCustom) throw new Error('No tienes permisos para crear joints.');
    const data = await createJoint(organizationId, body);
    return { status: true, data };
  }, { body: CreateJointRequest, response: t.Object({ status: t.Boolean(), data: t.Any() }) })

  // Edit joint info
  .patch('/api/joint/:slug', async ({ params: { slug }, organizationId, body }) => {
    if (!organizationId) throw new Error('Se requiere contexto de organización.');
    const data = await editJoint(slug, organizationId, body);
    return { status: true, data };
  }, { body: EditJointRequest, response: t.Object({ status: t.Boolean(), data: t.Any() }) })

  // Dissolve joint
  .delete('/api/joint/:slug', async ({ params: { slug }, organizationId, user }) => {
    if (!organizationId) throw new Error('Se requiere contexto de organización.');
    const data = await deleteJoint(slug, organizationId, user?.id ?? null);
    return { status: true, data };
  }, { response: t.Object({ status: t.Boolean(), data: t.Any() }) })

  // Leave joint (voluntary)
  .post('/api/joint/:slug/leave', async ({ params: { slug }, organizationId, user }) => {
    if (!organizationId) throw new Error('Se requiere contexto de organización.');
    const data = await leaveJoint(slug, organizationId, user?.id ?? null);
    return { status: true, data };
  }, { response: t.Object({ status: t.Boolean(), data: t.Any() }) })

  // Invite org to joint
  .post('/api/joint/:slug/invite', async ({ params: { slug }, organizationId, body, user }) => {
    if (!organizationId) throw new Error('Se requiere contexto de organización.');
    const data = await inviteToJoint(slug, organizationId, body, user?.id ?? null);
    return { status: true, data };
  }, { body: InviteToJointRequest, response: t.Object({ status: t.Boolean(), data: t.Any() }) })

  // Respond to invitation
  .patch('/api/joint/:slug/respond', async ({ params: { slug }, organizationId, body, user }) => {
    if (!organizationId) throw new Error('Se requiere contexto de organización.');
    const data = await respondToJointInvite(slug, organizationId, body, user?.id ?? null);
    return { status: true, data };
  }, { body: RespondToJointRequest, response: t.Object({ status: t.Boolean(), data: t.Any() }) })

  // Expel member
  .delete('/api/joint/:slug/member/:orgSlug', async ({ params: { slug, orgSlug }, organizationId, user }) => {
    if (!organizationId) throw new Error('Se requiere contexto de organización.');
    const data = await expelFromJoint(slug, organizationId, orgSlug, user?.id ?? null);
    return { status: true, data };
  }, { response: t.Object({ status: t.Boolean(), data: t.Any() }) })

  // Transfer leadership
  .patch('/api/joint/:slug/transfer', async ({ params: { slug }, organizationId, body, user }) => {
    if (!organizationId) throw new Error('Se requiere contexto de organización.');
    const data = await transferJointLeadership(slug, organizationId, body, user?.id ?? null);
    return { status: true, data };
  }, { body: TransferJointRequest, response: t.Object({ status: t.Boolean(), data: t.Any() }) })

  // Update member permissions
  .patch('/api/joint/:slug/member/:orgSlug/permissions', async ({ params: { slug, orgSlug }, organizationId, body }) => {
    if (!organizationId) throw new Error('Se requiere contexto de organización.');
    const data = await updateJointMemberPermissions(slug, organizationId, orgSlug, body);
    return { status: true, data };
  }, { body: UpdateJointMemberPermissionsRequest, response: t.Object({ status: t.Boolean(), data: t.Any() }) })

  // ─── JOINT CHAPTER ROUTES ────────────────────────────────────────────────────

  // Create joint chapter
  .post('/api/joint/:slug/chapter', async ({ params: { slug }, organizationId, body }) => {
    if (!organizationId) throw new Error('Se requiere contexto de organización.');
    const data = await createJointChapter(slug, organizationId, body);
    return { status: true, data };
  }, {
    body: CreateJointChapterRequest,
    response: t.Object({ status: t.Boolean(), data: t.Any() }),
    transform({ body }) {
      body.number = parseFloat(body.number.toString());
      if (body.releasedAt && body.releasedAt !== null) body.releasedAt = new Date(body.releasedAt as any);
      if (body.isUnreleased !== undefined && body.isUnreleased !== null) {
        body.isUnreleased = body.isUnreleased.toString() === 'true';
      }
      if (body.workedByOrganizationIds && Array.isArray(body.workedByOrganizationIds)) {
        body.workedByOrganizationIds = body.workedByOrganizationIds.map(id => parseInt(id.toString()));
      }
    },
  })

  // Edit joint chapter
  .patch('/api/joint/:slug/chapter/:number', async ({ params: { slug, number }, organizationId, body }) => {
    if (!organizationId) throw new Error('Se requiere contexto de organización.');
    const data = await editJointChapter(slug, parseFloat(number), organizationId, body);
    return { status: true, data };
  }, {
    body: EditJointChapterRequest,
    response: t.Object({ status: t.Boolean(), data: t.Any() }),
    transform({ body }) {
      if (body.releasedAt && body.releasedAt !== null) body.releasedAt = new Date(body.releasedAt as any);
      if (body.isUnreleased !== undefined && body.isUnreleased !== null) {
        body.isUnreleased = body.isUnreleased.toString() === 'true';
      }
      if (body.workedByOrganizationIds && Array.isArray(body.workedByOrganizationIds)) {
        body.workedByOrganizationIds = body.workedByOrganizationIds.map(id => parseInt(id.toString()));
      }
    },
  })

  // Delete joint chapter
  .delete('/api/joint/:slug/chapter/:number', async ({ params: { slug, number }, organizationId }) => {
    if (!organizationId) throw new Error('Se requiere contexto de organización.');
    const data = await deleteJointChapter(slug, parseFloat(number), organizationId);
    return { status: true, data };
  }, { response: t.Object({ status: t.Boolean(), data: t.Any() }) })

  // Promote a solo (MangaCustom) chapter into the joint
  .post('/api/joint/:slug/chapters/:chapterId/promote', async ({ params: { slug, chapterId }, organizationId, user }) => {
    if (!organizationId) throw new Error('Se requiere contexto de organización.');
    const data = await promoteChapterToJoint(slug, organizationId, parseInt(chapterId), user?.id ?? null);
    return { status: true, data };
  }, { response: t.Object({ status: t.Boolean(), data: t.Any() }) })

  // Demote a joint chapter back to its uploader's MangaCustom; ?replace=1 to overwrite a colliding cap.
  .post('/api/joint/:slug/chapters/:chapterId/demote', async ({ params: { slug, chapterId }, organizationId, user, query }) => {
    if (!organizationId) throw new Error('Se requiere contexto de organización.');
    const replace = (query as any)?.replace === '1' || (query as any)?.replace === 'true';
    const data = await demoteChapterFromJoint(slug, organizationId, parseInt(chapterId), {
      replace, actorUserId: user?.id ?? null,
    });
    return { status: true, data };
  }, { response: t.Object({ status: t.Boolean(), data: t.Any() }) })

  // Bulk move (skip-and-report)
  .post('/api/joint/:slug/chapters/bulk-move', async ({ params: { slug }, organizationId, user, body }) => {
    if (!organizationId) throw new Error('Se requiere contexto de organización.');
    const data = await bulkMoveJointChapters(slug, organizationId, body.chapterIds, body.direction, {
      replaceConflicts: body.replaceConflicts, actorUserId: user?.id ?? null,
    });
    return { status: true, data };
  }, { body: BulkMoveJointChaptersRequest, response: t.Object({ status: t.Boolean(), data: t.Any() }) })

  // Transfer chapter authorship
  .post('/api/joint/:slug/chapters/:chapterId/transfer-authorship', async ({ params: { slug, chapterId }, organizationId, user, body }) => {
    if (!organizationId) throw new Error('Se requiere contexto de organización.');
    const data = await transferChapterAuthorship(slug, organizationId, parseInt(chapterId), body.toOrganizationId, user?.id ?? null);
    return { status: true, data };
  }, { body: TransferAuthorshipRequest, response: t.Object({ status: t.Boolean(), data: t.Any() }) })

  // ─── JOINT FAVORITE ROUTES ──────────────────────────────────────────────────

  .get('/api/joint/:slug/favorite', async ({ params: { slug }, user }) => {
    const data = await getJointFavorite(user.id, slug);
    return { status: true, data };
  }, { response: t.Object({ status: t.Boolean(), data: t.Any() }) })

  .post('/api/joint/:slug/favorite', async ({ params: { slug }, user }) => {
    const data = await saveJointFavorite(user.id, slug);
    return { status: true, data };
  }, { response: t.Object({ status: t.Boolean(), data: t.Any() }) })

  .delete('/api/joint/:slug/favorite', async ({ params: { slug }, user }) => {
    const data = await deleteJointFavorite(user.id, slug);
    return { status: true, data };
  }, { response: t.Object({ status: t.Boolean(), data: t.Any() }) });
