import { Elysia, t } from "elysia";
import { loggedUserOnlyGlobal } from "../../plugins/auth";
import { reorderFavorites } from "../../controllers/favorites/reorder";

export const router = () =>
	new Elysia().use(loggedUserOnlyGlobal()).patch(
		"/api/favorites/reorder",
		async ({ user, body }) => {
			const result = await reorderFavorites(user.id, body.ids);
			return { status: true, data: result };
		},
		{
			body: t.Object({
				ids: t.Array(t.Number()),
			}),
			response: t.Object({
				status: t.Boolean(),
				data: t.Any(),
			}),
		},
	);
