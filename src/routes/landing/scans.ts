import { Elysia, t } from 'elysia';
import { getScans } from '../../controllers/landing/scans';

export const router = () => new Elysia()
	.get(
		'/api/landing/scans',
		async ({ query }) => {
			const includeNSFW = query?.includeNSFW === 'true';
			const page = query?.page ? Number.parseInt(query.page) || 1 : 1;
			const limit = query?.limit ? Number.parseInt(query.limit) || 20 : 20;
			const sort = (query?.sort === 'name' || query?.sort === 'mangas' || query?.sort === 'followers' || query?.sort === 'followers_7d')
				? query.sort
				: 'followers';
			const search = query?.search || '';

			const { items, total, maxPage, page: currentPage, limit: currentLimit } = await getScans({
				includeNSFW, page, limit, sort, search,
			});
			return { status: true, data: { items, total, maxPage, page: currentPage, limit: currentLimit } };
		},
		{
			query: t.Optional(
				t.Object({
					includeNSFW: t.Optional(t.String()),
					page: t.Optional(t.String()),
					limit: t.Optional(t.String()),
					sort: t.Optional(t.String()),
					search: t.Optional(t.String()),
				})
			),
			response: t.Object({
				status: t.Boolean(),
				data: t.Object({
					items: t.Array(
						t.Object({
							id: t.String(),
							name: t.String(),
							description: t.String(),
							url: t.String(),
							color: t.String(),
							logo: t.Nullable(t.String()),
							banner: t.Nullable(t.String()),
							isNSFW: t.Boolean(),
							followerCount: t.Number(),
							genres: t.Array(t.String()),
							totalMangas: t.Number(),
						})
					),
					total: t.Number(),
					maxPage: t.Number(),
					page: t.Number(),
					limit: t.Number(),
				}),
			}),
		}
	);
