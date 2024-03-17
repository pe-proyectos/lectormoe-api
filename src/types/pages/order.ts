import { Static, t } from 'elysia';

export const OrderPagesRequest = t.Array(t.Object({
    id: t.Number(),
    order: t.Number(),
}));

export type OrderPagesRequest = Static<typeof OrderPagesRequest>;
