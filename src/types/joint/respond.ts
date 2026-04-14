import { type Static, t } from 'elysia';

export const RespondToJointRequest = t.Object({
  accept: t.Boolean(),
});

export type RespondToJointRequest = Static<typeof RespondToJointRequest>;
