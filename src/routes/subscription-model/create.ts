import { Elysia, t } from 'elysia';

import { CreateSubscriptionModelRequest } from '../../types/subscription-model/create';
import { createSubscriptionModel } from '../../controllers/subscription-model/create';
import { loggedMemberOnly } from '../../plugins/auth';

export const router = () => new Elysia()
    .use(loggedMemberOnly())
    .post(
        '/api/subscription-model',
        async ({ organizationId, member, body }) => {
            if (!member.canCreateSubscriptionModel) {
                throw new Error("No tiene permisos para crear modelos de suscripción.");
            }

            const subscriptionModel = await createSubscriptionModel(organizationId, body);

            if (!subscriptionModel) {
                throw new Error("No se pudo crear el modelo de suscripción.");
            }

            return {
                status: true,
                data: subscriptionModel,
            };
        },
        {
            body: CreateSubscriptionModelRequest,
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
            transform({ body }) {
                body.readAnticipationHours = Number.parseInt(body.readAnticipationHours.toString());
                body.monthlyPrice = Number.parseFloat(body.monthlyPrice.toString());
                body.yearlyPrice = Number.parseFloat(body.yearlyPrice.toString());
                body.discountMonthlyPrice = Number.parseFloat(body.discountMonthlyPrice.toString());
                body.discountYearlyPrice = Number.parseFloat(body.discountYearlyPrice.toString());
                body.active = body.active.toString() === "true";
            },
        }
    );
