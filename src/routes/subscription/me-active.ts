import { Elysia, t } from "elysia";

import { loggedUserOnlyGlobal } from "../../plugins/auth";
import { editSubscription } from "../../controllers/subscription/edit";
import { getOwnSubscriptionById } from "../../controllers/subscription/me";
import { prisma } from "../../models/prisma";

export const router = () =>
  new Elysia().use(loggedUserOnlyGlobal()).patch(
    "/api/subscription/me/:id/active",
    async ({ user, params, body, set }) => {
      const id = Number.parseInt(params.id);
      if (Number.isNaN(id)) throw new Error("Id de suscripción inválido.");

      const ownSub = await getOwnSubscriptionById(user.id, id);
      if (!ownSub) {
        set.status = 404;
        throw new Error("Suscripción no encontrada.");
      }

      // editSubscription needs an organizationId. Subscriptions created prior to the
      // organization backfill may have a null organizationId; in that case, derive it
      // from the subscription plan so the controller's lookup still succeeds.
      let organizationId = ownSub.organizationId;
      if (!organizationId) {
        const plan = await prisma.subscriptionPlan.findUnique({
          where: { id: ownSub.subscriptionPlanId },
          select: { organizationId: true },
        });
        organizationId = plan?.organizationId ?? null;
      }
      if (!organizationId) {
        throw new Error("No se pudo determinar la organización de la suscripción.");
      }

      try {
        const updated = await editSubscription(organizationId, ownSub.id, {
          userId: user.id,
          active: !!body.active,
        });
        return { status: true, data: updated };
      } catch (err: any) {
        const message = err?.message || "No se pudo actualizar la suscripción.";
        throw new Error(message);
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ active: t.Boolean() }),
      response: t.Object({
        status: t.Boolean(),
        data: t.Any(),
      }),
    },
  );
