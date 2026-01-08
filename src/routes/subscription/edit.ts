import { Elysia, t } from "elysia";

import { EditSubscriptionRequest } from "../../types/subscription/edit";
import { editSubscription } from "../../controllers/subscription/edit";
import { loggedUserOnly } from "../../plugins/auth";

export const router = () =>
  new Elysia().use(loggedUserOnly()).patch(
    "/api/subscription/:subscriptionId",
    async ({ organizationId, user, body, params: { subscriptionId } }) => {
      const permissions = user.permissions.find((p: any) => p.organizationId === organizationId);
      if (user.id !== body.userId) {
        if (!permissions?.canEditSubscriptionPlan) {
          throw new Error(
            "No tiene permisos para editar suscripciones de otros usuarios."
          );
        }
      }

      const subscription = await editSubscription(
        organizationId,
        parseInt(subscriptionId),
        body
      );

      if (!subscription) {
        throw new Error("No se pudo editar la suscripción.");
      }

      return {
        status: true,
        data: subscription,
      };
    },
    {
      body: EditSubscriptionRequest,
      response: t.Object({
        status: t.Boolean(),
        data: t.Any(),
      }),
      transform({ params, body }) {
        if (params.subscriptionId) {
          params.subscriptionId = Number.parseInt(
            params.subscriptionId.toString()
          );
        }
        if (body.userId) {
          body.userId = Number.parseInt(body.userId.toString());
        }
        if (body.active !== undefined) {
          body.active = body.active.toString() === "true";
        }
      },
    }
  );
