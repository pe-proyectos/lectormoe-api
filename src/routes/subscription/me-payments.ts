import { Elysia, t } from "elysia";

import { loggedUserOnlyGlobal } from "../../plugins/auth";
import { listOwnSubscriptionPayments } from "../../controllers/subscription/me";

export const router = () =>
  new Elysia().use(loggedUserOnlyGlobal()).get(
    "/api/subscription/me/:id/payments",
    async ({ user, params, set }) => {
      const id = Number.parseInt(params.id);
      if (Number.isNaN(id)) throw new Error("Id de suscripción inválido.");

      const data = await listOwnSubscriptionPayments(user.id, id);
      if (data === null) {
        set.status = 404;
        throw new Error("Suscripción no encontrada.");
      }

      return { status: true, data };
    },
    {
      params: t.Object({ id: t.String() }),
      response: t.Object({
        status: t.Boolean(),
        data: t.Array(t.Any()),
      }),
    },
  );
