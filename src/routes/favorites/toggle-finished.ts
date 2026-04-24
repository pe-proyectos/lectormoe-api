import { Elysia, t } from "elysia";
import { loggedUserOnlyGlobal } from "../../plugins/auth";
import { toggleFavoriteFinished } from "../../controllers/favorites/toggle-finished";

export const router = () =>
	new Elysia().use(loggedUserOnlyGlobal()).patch(
		"/api/favorites/:id/finished",
		async ({ user, params, body }) => {
			const id = Number.parseInt(params.id);
			if (Number.isNaN(id)) throw new Error("Id inválido.");
			const data = await toggleFavoriteFinished(user.id, id, !!body.finished);
			return { status: true, data };
		},
		{
			params: t.Object({ id: t.String() }),
			body: t.Object({ finished: t.Boolean() }),
			response: t.Object({ status: t.Boolean(), data: t.Any() }),
		},
	);
