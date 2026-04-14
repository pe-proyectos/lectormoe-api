import { type Static, t } from 'elysia';

export const TransferJointRequest = t.Object({
  organizationSlug: t.String(),
});

export type TransferJointRequest = Static<typeof TransferJointRequest>;
