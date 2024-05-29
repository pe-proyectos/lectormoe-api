import { type Static, t } from 'elysia';

export const CreateSubscriptionModelRequest = t.Object({
    title: t.String(),
    description: t.Optional(t.String()),
    benefits: t.Optional(t.String()),
    readAnticipationHours: t.Number(),
    monthlyPrice: t.Number(),
    yearlyPrice: t.Number(),
    discountMonthlyPrice: t.Number(),
    discountYearlyPrice: t.Number(),
    active: t.Boolean(),
});

export type CreateSubscriptionModelRequest = Static<typeof CreateSubscriptionModelRequest>;
