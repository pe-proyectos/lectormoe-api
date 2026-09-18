import { type Static, t } from 'elysia';
import { PaginationQuery } from '../common/pagination';

export const SubscriptionPlanListQuery = t.Object({
    name: t.Optional(t.String()),
    slug: t.Optional(t.String()),
    description: t.Optional(t.String()),
    price: t.Optional(t.Number()),
    interval: t.Optional(t.String()),
    currency: t.Optional(t.String()),
    // 'true' (por defecto) | 'false' | 'all'. Falla cerrado: quien no lo
    // indique recibe solo planes activos, para que un plan retirado no vuelva a
    // aparecer en la pagina publica ni se pueda contratar.
    active: t.Optional(t.Union([t.Boolean(), t.String()])),
    ...PaginationQuery.properties,
});

export type SubscriptionPlanListQuery = Static<typeof SubscriptionPlanListQuery>;
