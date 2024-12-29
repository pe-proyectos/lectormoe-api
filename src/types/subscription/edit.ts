import { type Static, t } from 'elysia';

export const EditSubscriptionRequest = t.Object({
    active: t.Boolean(),
    userId: t.Number(),
});

export type EditSubscriptionRequest = Static<typeof EditSubscriptionRequest>;
