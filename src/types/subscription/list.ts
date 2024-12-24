import { type Static, t } from 'elysia';
import { PaginationQuery } from '../common/pagination';

export const SubscriptionListQuery = t.Object({
    userId: t.Number(),
    subscriptionPlanId: t.Number(),
    status: t.Optional(t.String()),
    startDate: t.Optional(t.String()),
    endDate: t.Optional(t.String()),
    lastPayment: t.Optional(t.String()),
    ...PaginationQuery.properties,
});

export type SubscriptionListQuery = Static<typeof SubscriptionListQuery>;
