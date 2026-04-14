import { type Static, t } from 'elysia';

export const UpdateJointMemberPermissionsRequest = t.Object({
  canEditJoint: t.Optional(t.Boolean()),
  canInvite: t.Optional(t.Boolean()),
  canExpel: t.Optional(t.Boolean()),
  role: t.Optional(t.Union([t.Literal('UPLOADER'), t.Literal('VIEWER'), t.Literal('LEADER')])),
});

export type UpdateJointMemberPermissionsRequest = Static<typeof UpdateJointMemberPermissionsRequest>;
