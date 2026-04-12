import { type Static, t } from 'elysia';

export const CreateSubscriptionPlanRequest = t.Object({
    name: t.String(),
    description: t.Optional(t.Union([t.String(), t.Null()])),
    price: t.Number({ minimum: 1, maximum: 1000 }),
    interval: t.String({ pattern: "^(DAY|WEEK|MONTH|YEAR)$" }),
    currency: t.String({ pattern: "^(USD)$" }),
    active: t.Boolean(),
    hideAds: t.Boolean(),
    canDownload: t.Boolean(),
    canReadUnreleased: t.Boolean(),
});

export type CreateSubscriptionPlanRequest = Static<typeof CreateSubscriptionPlanRequest>;
