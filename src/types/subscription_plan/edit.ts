import { type Static, t } from 'elysia';

export const EditSubscriptionPlanRequest = t.Object({
    name: t.Optional(t.String()),
    description: t.Optional(t.String()),
    price: t.Optional(t.Number()),
    interval: t.Optional(t.String()),
    currency: t.Optional(t.String()),
    planId: t.Optional(t.String()),
});

export type EditSubscriptionPlanRequest = Static<typeof EditSubscriptionPlanRequest>;
