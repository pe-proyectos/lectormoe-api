import { type Static, t } from 'elysia';

export const EditSubscriptionPlanRequest = t.Object({
    name: t.Optional(t.String()),
    description: t.Optional(t.String()),
    active: t.Optional(t.Boolean()),
    showAds: t.Optional(t.Boolean()),
    canDownload: t.Optional(t.Boolean()),
    canReadUnreleased: t.Optional(t.Boolean()),
});

export type EditSubscriptionPlanRequest = Static<typeof EditSubscriptionPlanRequest>;
