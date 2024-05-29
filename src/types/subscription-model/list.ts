import { type Static, t } from 'elysia';
import { PaginationQuery } from '../common/pagination';

export const SubscriptionModelListQuery = t.Object({
    title: t.Optional(t.String()),
    description: t.Optional(t.String()),
    benefits: t.Optional(t.String()),
    readAnticipationHours: t.Optional(t.Number()),
    monthlyPrice: t.Optional(t.Number()),
    yearlyPrice: t.Optional(t.Number()),
    discountMonthlyPrice: t.Optional(t.Number()),
    discountYearlyPrice: t.Optional(t.Number()),
    active: t.Optional(t.Boolean()),
    ...PaginationQuery.properties,
});

export type SubscriptionModelListQuery = Static<typeof SubscriptionModelListQuery>;
