import { type Static, t } from 'elysia';

export const CreateCoinPackRequest = t.Object({
    name: t.String(),
    description: t.Optional(t.String()),
    priceWithoutDiscount: t.Number(),
    price: t.Number(),
    coins: t.Number(),
    active: t.Boolean(),
});

export type CreateCoinPackRequest = Static<typeof CreateCoinPackRequest>;
