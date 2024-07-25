import { type Static, t } from 'elysia';
import { PaginationQuery } from '../common/pagination';

export const CoinPackListQuery = t.Object({
    name: t.Optional(t.String()),
    slug: t.Optional(t.String()),
    description: t.Optional(t.String()),
    priceWithoutDiscount: t.Optional(t.Number()),
    price: t.Optional(t.Number()),
    coins: t.Optional(t.Number()),
    active: t.Optional(t.Boolean()),
    ...PaginationQuery.properties,
});

export type CoinPackListQuery = Static<typeof CoinPackListQuery>;
