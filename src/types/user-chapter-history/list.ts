import { type Static, t } from 'elysia';
import { PaginationQuery } from '../common/pagination';

export const UserChapterHistoryListQuery = t.Object({
    manga_slug: t.Optional(t.String()),
    include_finished: t.Optional(t.Boolean()),
    ...PaginationQuery.properties,
});

export type UserChapterHistoryListQuery = Static<typeof UserChapterHistoryListQuery>;
