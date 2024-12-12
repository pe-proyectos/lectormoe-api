import { Elysia, t } from 'elysia';

import { editSubscriptionPlan } from '../../controllers/subscription_plan/edit';
import { loggedUserOnly } from '../../plugins/auth';
import { EditSubscriptionPlanRequest } from '../../types/subscription_plan/edit';

export const router = () => new Elysia()
    .use(loggedUserOnly())
    .patch(
        '/api/subscription-plan/:subscriptionPlanId',
        async ({ organizationId, user, body, params: { subscriptionPlanId } }) => {
            if (!user.canEditSubscriptionPlan) {
                throw new Error("No tiene permisos para editar planes de suscripción.");
            }

            const subscriptionPlan = await editSubscriptionPlan(organizationId, parseInt(subscriptionPlanId), body);

            if (!subscriptionPlan) {
                throw new Error("No se pudo editar el plan de suscripción.");
            }

            return {
                status: true,
                data: subscriptionPlan,
            };
        },
        {
            body: EditSubscriptionPlanRequest,
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
            transform({ body }) {
                if (body.price) {
                    body.price = Number.parseFloat(body.price.toString());
                }
                if (body.interval) {
                    body.interval = body.interval.toString();
                }
                if (body.currency) {
                    body.currency = body.currency.toString();
                }
                if (body.planId) {
                    body.planId = body.planId.toString();
                }
            },
        }
    );
