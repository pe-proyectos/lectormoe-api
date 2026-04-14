import { type Static, t } from 'elysia';

export const InviteToJointRequest = t.Object({
  organizationSlug: t.String(),
  role: t.Union([t.Literal('UPLOADER'), t.Literal('VIEWER')]),
});

export type InviteToJointRequest = Static<typeof InviteToJointRequest>;
