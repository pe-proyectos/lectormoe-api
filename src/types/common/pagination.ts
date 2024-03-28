import { Static, t } from 'elysia';

export const PaginationQuery = t.Object({
    page: t.Optional(t.String()),
    limit: t.Optional(t.String()),
});

export type PaginationQuery = Static<typeof PaginationQuery>;
