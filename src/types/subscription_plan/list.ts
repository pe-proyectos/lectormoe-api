import { type Static, t } from 'elysia';
import { PaginationQuery } from '../common/pagination';

export const SubscriptionPlanListQuery = t.Object({
    name: t.Optional(t.String()),
    slug: t.Optional(t.String()),
    description: t.Optional(t.String()),
    price: t.Optional(t.Number()),
    interval: t.Optional(t.String()),
    currency: t.Optional(t.String()),
    active: t.Optional(t.Boolean()),
    ...PaginationQuery.properties,
});

export type SubscriptionPlanListQuery = Static<typeof SubscriptionPlanListQuery>;
