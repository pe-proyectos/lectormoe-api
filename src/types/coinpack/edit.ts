import { type Static, t } from 'elysia';

export const EditCoinPackRequest = t.Object({
    name: t.Optional(t.String()),
    description: t.Optional(t.String()),
    priceWithoutDiscount: t.Optional(t.Number()),
    price: t.Optional(t.Number()),
    coins: t.Optional(t.Number()),
    active: t.Optional(t.Boolean()),
});

export type EditCoinPackRequest = Static<typeof EditCoinPackRequest>;
