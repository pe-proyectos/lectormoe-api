import { type Static, t } from 'elysia';

export const CreateAnalyticsRequest = t.Object({
    event: t.String(),
    path: t.String(),
    userAgent: t.String(),
    screenWidth: t.Number(),
    screenHeight: t.Number(),
    payload: t.Optional(t.Any()),
});

export type CreateAnalyticsRequest = Static<typeof CreateAnalyticsRequest>;
