import { type Static, t } from 'elysia';

export const CreateJointRequest = t.Object({
  mangaSlug: t.String(),
});

export type CreateJointRequest = Static<typeof CreateJointRequest>;
