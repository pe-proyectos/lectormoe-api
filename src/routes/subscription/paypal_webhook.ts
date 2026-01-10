import { Elysia, t } from 'elysia';
import { PaypalWebhookEvent } from '../../types/subscription/paypal_webhook';
import { handlePaypalWebhook } from '../../controllers/subscription/paypal_webhook';
import { verifyPayPalWebhookSignature } from '../../util/paypal-webhook-verification';

export const router = () => new Elysia()
    .post(
        '/api/paypal/webhook',
        async ({ body, headers }) => {
            // SECURITY: Verify webhook signature to prevent unauthorized access
            const webhookId = process.env.PAYPAL_WEBHOOK_ID;

            if (!webhookId) {
                console.error('PAYPAL_WEBHOOK_ID not configured in environment');
                return {
                    status: false,
                    error: 'Webhook verification not configured',
                };
            }

            const webhookHeaders = {
                'paypal-transmission-id': headers['paypal-transmission-id'] || '',
                'paypal-transmission-time': headers['paypal-transmission-time'] || '',
                'paypal-transmission-sig': headers['paypal-transmission-sig'] || '',
                'paypal-cert-url': headers['paypal-cert-url'] || '',
                'paypal-auth-algo': headers['paypal-auth-algo'] || '',
            };

            const isValid = await verifyPayPalWebhookSignature(webhookHeaders, body, webhookId);

            if (!isValid) {
                console.error('PayPal webhook signature verification failed');
                console.error('Headers:', webhookHeaders);
                return {
                    status: false,
                    error: 'Invalid webhook signature',
                };
            }

            // Signature is valid, process the webhook
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
                message: t.Optional(t.String()),
                error: t.Optional(t.String()),
            }),
        }
    );
