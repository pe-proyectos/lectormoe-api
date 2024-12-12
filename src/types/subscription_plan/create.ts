import { type Static, t } from 'elysia';

export const CreateSubscriptionPlanRequest = t.Object({
    name: t.String(),
    description: t.Optional(t.String()),
    price: t.Number(),
    interval: t.String(),
    currency: t.String(),
    planId: t.String(),
});

export type CreateSubscriptionPlanRequest = Static<typeof CreateSubscriptionPlanRequest>;
