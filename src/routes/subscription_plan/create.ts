import { Elysia, t } from 'elysia';

import { CreateSubscriptionPlanRequest } from '../../types/subscription_plan/create';
import { createSubscriptionPlan } from '../../controllers/subscription_plan/create';
import { loggedUserOnly } from '../../plugins/auth';

export const router = () => new Elysia()
    .use(loggedUserOnly())
    .post(
        '/api/subscription-plan',
        async ({ organizationId, user, body }) => {
            if (!user.canCreateSubscriptionPlan) {
                throw new Error("No tiene permisos para crear planes de suscripción.");
            }

            const subscriptionPlan = await createSubscriptionPlan(organizationId, body);

            if (!subscriptionPlan) {
                throw new Error("No se pudo crear el plan de suscripción.");
            }

            return {
                status: true,
                data: subscriptionPlan,
            };
        },
        {
            body: CreateSubscriptionPlanRequest,
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
            transform({ body }) {
                body.price = Number.parseFloat(body.price.toString());
                body.interval = body.interval.toString();
                body.currency = body.currency.toString();
                body.active = body.active.toString() === "true";
                body.hideAds = body.hideAds.toString() === "true";
                body.canDownload = body.canDownload.toString() === "true";
                body.canReadUnreleased = body.canReadUnreleased.toString() === "true";
            },
        }
    );
