import { Static, t } from 'elysia';
import { PaginationQuery } from '../common/pagination';

export const UserChapterHistoryListQuery = t.Object({
    ...PaginationQuery.properties,
});

export type UserChapterHistoryListQuery = Static<typeof UserChapterHistoryListQuery>;
