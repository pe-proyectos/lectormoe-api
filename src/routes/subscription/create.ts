import { Elysia, t } from 'elysia';

import { CreateSubscriptionRequest } from '../../types/subscription/create';
import { createSubscription } from '../../controllers/subscription/create';
import { loggedUserOnly } from '../../plugins/auth';

export const router = () => new Elysia()
    .use(loggedUserOnly())
    .post(
        '/api/subscription',
        async ({ organizationId, user, body }) => {
            const subscription = await createSubscription(organizationId, user.id, body);
            
            if (!subscription) {
                throw new Error("No se pudo crear la suscripción.");
            }

            return {
                status: true,
                data: subscription,
            };
        },
        {
            body: CreateSubscriptionRequest,
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
        }
    );
