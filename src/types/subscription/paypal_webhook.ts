import { type Static, t } from 'elysia';

export const PaypalWebhookEvent = t.Object({
    event_type: t.String(),
    resource: t.Object({
        id: t.String(),
        state: t.String(),
        // Add other fields as needed based on the PayPal webhook documentation
    }),
    // Add other fields as needed based on the PayPal webhook documentation
});

export type PaypalWebhookEvent = Static<typeof PaypalWebhookEvent>;
