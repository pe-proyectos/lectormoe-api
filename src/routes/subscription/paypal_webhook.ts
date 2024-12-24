import { Elysia, t } from 'elysia';
import { PaypalWebhookEvent } from '../../types/subscription/paypal_webhook';
import { handlePaypalWebhook } from '../../controllers/subscription/paypal_webhook';

export const router = () => new Elysia()
    .post(
        '/api/paypal/webhook',
        async ({ body }) => {
            await handlePaypalWebhook(body);
            return {
                status: true,
                message: 'Webhook processed successfully',
            };
        },
        {
            body: PaypalWebhookEvent,
            response: t.Object({
                status: t.Boolean(),
                message: t.String(),
            }),
        }
    );
