import { Static, t } from 'elysia';
import { PaginationQuery } from '../common/pagination';

export const NewsListQuery = t.Object({
    ...PaginationQuery.properties,
});

export type NewsListQuery = Static<typeof NewsListQuery>;
