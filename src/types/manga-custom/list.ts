import { type Static, t } from 'elysia';
import { PaginationQuery } from '../common/pagination';

export enum OrderEnum {
    FEATURED = 'featured',
    POPULAR = 'popular',
    LATEST = 'latest',
}

export enum BookTypeCodeEnum {
    MANGA = 'manga',
    MANHUA = 'manhua',
    MANHWA = 'manhwa',
}

export const MangaCustomListQuery = t.Object({
    title: t.Optional(t.String()),
    shortDescription: t.Optional(t.String()),
    description: t.Optional(t.String()),
    search: t.Optional(t.String()),
    order: t.Optional(t.Enum(OrderEnum)),
    type: t.Optional(t.Enum(BookTypeCodeEnum)),
    ids: t.Optional(t.String()), // Comma-separated IDs
    nsfw: t.Optional(t.String()), // 'true' = only NSFW, 'false' = only non-NSFW, omitted = all
    showDeleted: t.Optional(t.String()), // 'true' = only deleted, omitted = only active
    ...PaginationQuery.properties,
});

export type MangaCustomListQuery = Static<typeof MangaCustomListQuery>;
