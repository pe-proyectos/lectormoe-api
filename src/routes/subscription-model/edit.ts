import { Elysia, t } from 'elysia';

import { editSubscriptionModel } from '../../controllers/subscription-model/edit';
import { loggedMemberOnly } from '../../plugins/auth';
import { EditSubscriptionModelRequest } from '../../types/subscription-model/edit';

export const router = () => new Elysia()
    .use(loggedMemberOnly())
    .patch(
        '/api/subscription-model/:subscriptionModelId',
        async ({ organizationId, member, body, params: { subscriptionModelId } }) => {
            if (!member.canEditSubscriptionModel) {
                throw new Error("No tiene permisos para editar modelos de suscripción.");
            }

            const subscriptionModel = await editSubscriptionModel(organizationId, parseInt(subscriptionModelId), body);

            if (!subscriptionModel) {
                throw new Error("No se pudo editar el modelo de suscripción.");
            }

            return {
                status: true,
                data: subscriptionModel,
            };
        },
        {
            body: EditSubscriptionModelRequest,
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
            transform({ body }) {
                if (body.readAnticipationHours) {
                    body.readAnticipationHours = Number.parseInt(body.readAnticipationHours.toString());
                }
                if (body.monthlyPrice) {
                    body.monthlyPrice = Number.parseFloat(body.monthlyPrice.toString());
                }
                if (body.yearlyPrice) {
                    body.yearlyPrice = Number.parseFloat(body.yearlyPrice.toString());
                }
                if (body.discountMonthlyPrice) {
                    body.discountMonthlyPrice = Number.parseFloat(body.discountMonthlyPrice.toString());
                }
                if (body.discountYearlyPrice) {
                    body.discountYearlyPrice = Number.parseFloat(body.discountYearlyPrice.toString());
                }
                if (body.active) {
                    body.active = body.active.toString() === "true";
                }
            },
        }
    );
