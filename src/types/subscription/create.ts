import { type Static, t } from 'elysia';

export const CreateSubscriptionRequest = t.Object({
    paypalSubscriptionId: t.String(),
    subscriptionPlanId: t.Number(),
    userId: t.Number(),
});

export type CreateSubscriptionRequest = Static<typeof CreateSubscriptionRequest>;
