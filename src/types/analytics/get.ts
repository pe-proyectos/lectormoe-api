import { type Static, t } from 'elysia';

export const GetAnalyticsQuery = t.Object({
    from: t.Optional(t.String()),
    to: t.Optional(t.String()),
});

export type GetAnalyticsQuery = Static<typeof GetAnalyticsQuery>;
