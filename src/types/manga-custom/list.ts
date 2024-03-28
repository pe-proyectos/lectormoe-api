import { Static, t } from 'elysia';
import { PaginationQuery } from '../common/pagination';

export enum OrderEnum {
    FEATURED = 'featured',
    POPULAR = 'popular',
    LATEST = 'latest',
}

export const MangaCustomListQuery = t.Object({
    title: t.Optional(t.String()),
    shortDescription: t.Optional(t.String()),
    description: t.Optional(t.String()),
    order: t.Optional(t.Enum(OrderEnum)),
    ...PaginationQuery.properties,
});

export type MangaCustomListQuery = Static<typeof MangaCustomListQuery>;
