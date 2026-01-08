import { Elysia, t } from 'elysia';

import { editSubscriptionPlan } from '../../controllers/subscription_plan/edit';
import { loggedUserOnly } from '../../plugins/auth';
import { EditSubscriptionPlanRequest } from '../../types/subscription_plan/edit';

export const router = () => new Elysia()
    .use(loggedUserOnly())
    .patch(
        '/api/subscription-plan/:subscriptionPlanId',
        async ({ organizationId, user, body, params: { subscriptionPlanId } }) => {
            const permissions = user.permissions.find((p: any) => p.organizationId === organizationId);
            if (!permissions?.canEditSubscriptionPlan) {
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
                if (body.active !== undefined) {
                    body.active = body.active.toString() === "true";
                }
                if (body.hideAds !== undefined) {
                    body.hideAds = body.hideAds.toString() === "true";
                }
                if (body.canDownload !== undefined) {
                    body.canDownload = body.canDownload.toString() === "true";
                }
                if (body.canReadUnreleased !== undefined) {
                    body.canReadUnreleased = body.canReadUnreleased.toString() === "true";
                }
            },
        }
    );
