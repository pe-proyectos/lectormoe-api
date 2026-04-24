import { Elysia, t } from "elysia";

import { loggedOptional, loggedUserOnlyGlobal } from "../../plugins/auth";
import { listUserList } from "../../controllers/user-list/list";
import { saveUserListManga, saveUserListJoint } from "../../controllers/user-list/save";
import { getUserListManga, getUserListJoint } from "../../controllers/user-list/get";
import { deleteUserListManga, deleteUserListJoint } from "../../controllers/user-list/delete";
import { reorderUserList } from "../../controllers/user-list/reorder";
import { toggleUserListFinished } from "../../controllers/user-list/toggle-finished";

export const router = () =>
	new Elysia()
		// List (authenticated, org-optional filter)
		.group("", (app) =>
			app.use(loggedOptional()).get(
				"/api/user-list",
				async ({ logged, user, organizationId, query }) => {
					if (!logged || !user) throw new Error("No autorizado");
					const type = query?.type === 'manga' || query?.type === 'joint' ? query.type : undefined;
					const sort = query?.sort === 'recent' || query?.sort === 'title' ? query.sort : 'order';
					const { data, maxPage, total } = await listUserList(organizationId, user.id, {
						page: query?.page,
						limit: query?.limit,
						search: query?.search,
						status: query?.status,
						type,
						scanSlug: query?.scanSlug,
						sort,
					});
					return { status: true, data: { items: data, maxPage, total } };
				},
				{
					query: t.Optional(
						t.Object({
							page: t.Optional(t.String()),
							limit: t.Optional(t.String()),
							search: t.Optional(t.String()),
							status: t.Optional(t.String()),
							type: t.Optional(t.String()),
							scanSlug: t.Optional(t.String()),
							sort: t.Optional(t.String()),
						}),
					),
					response: t.Object({ status: t.Boolean(), data: t.Any() }),
				},
			),
		)
		// Per-item get/save/delete for manga-custom
		.group("", (app) =>
			app
				.use(loggedOptional())
				.get(
					"/api/user-list/manga-custom/:mangaSlug",
					async ({ logged, user, organizationId, params: { mangaSlug } }) => {
						if (!logged || !user) throw new Error("No autorizado");
						const inList = await getUserListManga(organizationId, user.id, mangaSlug);
						return { status: true, data: inList };
					},
					{ response: t.Object({ status: t.Boolean(), data: t.Boolean() }) },
				)
				.post(
					"/api/user-list/manga-custom/:mangaSlug",
					async ({ logged, user, organizationId, params: { mangaSlug } }) => {
						if (!logged || !user) throw new Error("No autorizado");
						const ok = await saveUserListManga(organizationId, user.id, mangaSlug);
						return { status: true, data: !!ok };
					},
					{
						params: t.Object({ mangaSlug: t.String() }),
						response: t.Object({ status: t.Boolean(), data: t.Any() }),
					},
				)
				.delete(
					"/api/user-list/manga-custom/:mangaSlug",
					async ({ logged, user, organizationId, params: { mangaSlug } }) => {
						if (!logged || !user) throw new Error("No autorizado");
						const ok = await deleteUserListManga(organizationId, user.id, mangaSlug);
						return { status: true, data: !!ok };
					},
					{
						params: t.Object({ mangaSlug: t.String() }),
						response: t.Object({ status: t.Boolean(), data: t.Any() }),
					},
				),
		)
		// Per-item get/save/delete for joint (org-less — joint is global)
		.group("", (app) =>
			app
				.use(loggedUserOnlyGlobal())
				.get(
					"/api/user-list/joint/:slug",
					async ({ user, params: { slug } }) => {
						const inList = await getUserListJoint(user.id, slug);
						return { status: true, data: inList };
					},
					{ response: t.Object({ status: t.Boolean(), data: t.Boolean() }) },
				)
				.post(
					"/api/user-list/joint/:slug",
					async ({ user, params: { slug } }) => {
						const ok = await saveUserListJoint(user.id, slug);
						return { status: true, data: !!ok };
					},
					{ response: t.Object({ status: t.Boolean(), data: t.Any() }) },
				)
				.delete(
					"/api/user-list/joint/:slug",
					async ({ user, params: { slug } }) => {
						const ok = await deleteUserListJoint(user.id, slug);
						return { status: true, data: !!ok };
					},
					{ response: t.Object({ status: t.Boolean(), data: t.Any() }) },
				)
				.patch(
					"/api/user-list/reorder",
					async ({ user, body }) => {
						const result = await reorderUserList(user.id, body.ids);
						return { status: true, data: result };
					},
					{
						body: t.Object({ ids: t.Array(t.Number()) }),
						response: t.Object({ status: t.Boolean(), data: t.Any() }),
					},
				)
				.patch(
					"/api/user-list/:id/finished",
					async ({ user, params, body }) => {
						const id = Number.parseInt(params.id);
						if (Number.isNaN(id)) throw new Error("Id inválido.");
						const data = await toggleUserListFinished(user.id, id, !!body.finished);
						return { status: true, data };
					},
					{
						params: t.Object({ id: t.String() }),
						body: t.Object({ finished: t.Boolean() }),
						response: t.Object({ status: t.Boolean(), data: t.Any() }),
					},
				),
		);
