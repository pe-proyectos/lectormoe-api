import { type Static, t } from 'elysia';
import { PaginationQuery } from '../common/pagination';

export const FavoritesListQuery = t.Object({
    ...PaginationQuery.properties,
});

export type FavoritesListQuery = Static<typeof FavoritesListQuery>;
