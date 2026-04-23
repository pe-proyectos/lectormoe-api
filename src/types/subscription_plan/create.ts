import { type Static, t } from 'elysia';

// PayPal supports billing plans in many currencies — we allow the ones our UI offers.
// Price range 1..10000 in the chosen currency (≈ 10000 MXN = ~550 USD as of 2026).
export const CreateSubscriptionPlanRequest = t.Object({
    name: t.String(),
    description: t.Optional(t.String()),
    price: t.Number({ minimum: 1, maximum: 10000 }),
    interval: t.String({ pattern: "^(DAY|WEEK|MONTH|YEAR)$" }),
    currency: t.String({ pattern: "^(USD|EUR|MXN)$" }),
    active: t.Boolean(),
    hideAds: t.Boolean(),
    canDownload: t.Boolean(),
    canReadUnreleased: t.Boolean(),
});

export type CreateSubscriptionPlanRequest = Static<typeof CreateSubscriptionPlanRequest>;
