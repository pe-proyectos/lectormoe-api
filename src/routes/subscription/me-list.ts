import { Elysia, t } from "elysia";

import { loggedUserOnlyGlobal } from "../../plugins/auth";
import { listOwnSubscriptions } from "../../controllers/subscription/me";

export const router = () =>
  new Elysia().use(loggedUserOnlyGlobal()).get(
    "/api/subscription/me",
    async ({ user }) => {
      const data = await listOwnSubscriptions(user.id);
      return { status: true, data };
    },
    {
      response: t.Object({
        status: t.Boolean(),
        data: t.Array(t.Any()),
      }),
    },
  );
