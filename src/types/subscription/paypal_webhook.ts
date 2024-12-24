import { type Static, t } from 'elysia';

export const PaypalWebhookEvent = t.Any();

export type PaypalWebhookEvent = Static<typeof PaypalWebhookEvent>;
