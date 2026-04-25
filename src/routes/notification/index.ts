import { Elysia, t } from "elysia";

import { loggedUserOnlyGlobal } from "../../plugins/auth";
import { listNotifications } from "../../controllers/notification/list";
import { unreadCount } from "../../controllers/notification/unread-count";
import { markRead } from "../../controllers/notification/mark-read";
import { markAllRead } from "../../controllers/notification/mark-all-read";

export const router = () =>
	new Elysia()
		.group("", (app) =>
			app
				.use(loggedUserOnlyGlobal())
				.get(
					"/api/notifications",
					async ({ user, query }) => {
						const data = await listNotifications(user.id, {
							page: query?.page,
							limit: query?.limit,
							unreadOnly: query?.unreadOnly,
						});
						return { status: true, data };
					},
					{
						query: t.Optional(
							t.Object({
								page: t.Optional(t.String()),
								limit: t.Optional(t.String()),
								unreadOnly: t.Optional(t.String()),
							}),
						),
						response: t.Object({ status: t.Boolean(), data: t.Any() }),
					},
				)
				.get(
					"/api/notifications/unread-count",
					async ({ user }) => {
						const data = await unreadCount(user.id);
						return { status: true, data };
					},
					{ response: t.Object({ status: t.Boolean(), data: t.Any() }) },
				)
				.patch(
					"/api/notifications/read-all",
					async ({ user }) => {
						const data = await markAllRead(user.id);
						return { status: true, data };
					},
					{ response: t.Object({ status: t.Boolean(), data: t.Any() }) },
				)
				.patch(
					"/api/notifications/:id/read",
					async ({ user, params }) => {
						const id = Number.parseInt(params.id);
						if (Number.isNaN(id)) throw new Error("Id inválido.");
						const data = await markRead(user.id, id);
						return { status: true, data };
					},
					{
						params: t.Object({ id: t.String() }),
						response: t.Object({ status: t.Boolean(), data: t.Any() }),
					},
				),
		);
