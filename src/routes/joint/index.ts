import { Elysia, t } from 'elysia';
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

export const router = () => new Elysia()
  // ─── PUBLIC ROUTES ──────────────────────────────────────────────────────────
  .get('/api/joint/:slug', async ({ params: { slug } }) => {
    const data = await getJoint(slug);
    return { status: true, data };
  }, { response: t.Object({ status: t.Boolean(), data: t.Any() }) })

  .get('/api/joint/:slug/chapter/:number', async ({ params: { slug, number } }) => {
    const data = await getJointChapter(slug, parseFloat(number));
    return { status: true, data };
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
  .delete('/api/joint/:slug', async ({ params: { slug }, organizationId }) => {
    if (!organizationId) throw new Error('Se requiere contexto de organización.');
    const data = await deleteJoint(slug, organizationId);
    return { status: true, data };
  }, { response: t.Object({ status: t.Boolean(), data: t.Any() }) })

  // Invite org to joint
  .post('/api/joint/:slug/invite', async ({ params: { slug }, organizationId, body }) => {
    if (!organizationId) throw new Error('Se requiere contexto de organización.');
    const data = await inviteToJoint(slug, organizationId, body);
    return { status: true, data };
  }, { body: InviteToJointRequest, response: t.Object({ status: t.Boolean(), data: t.Any() }) })

  // Respond to invitation
  .patch('/api/joint/:slug/respond', async ({ params: { slug }, organizationId, body }) => {
    if (!organizationId) throw new Error('Se requiere contexto de organización.');
    const data = await respondToJointInvite(slug, organizationId, body);
    return { status: true, data };
  }, { body: RespondToJointRequest, response: t.Object({ status: t.Boolean(), data: t.Any() }) })

  // Expel member
  .delete('/api/joint/:slug/member/:orgSlug', async ({ params: { slug, orgSlug }, organizationId }) => {
    if (!organizationId) throw new Error('Se requiere contexto de organización.');
    const data = await expelFromJoint(slug, organizationId, orgSlug);
    return { status: true, data };
  }, { response: t.Object({ status: t.Boolean(), data: t.Any() }) })

  // Transfer leadership
  .patch('/api/joint/:slug/transfer', async ({ params: { slug }, organizationId, body }) => {
    if (!organizationId) throw new Error('Se requiere contexto de organización.');
    const data = await transferJointLeadership(slug, organizationId, body);
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
  }, { response: t.Object({ status: t.Boolean(), data: t.Any() }) });
