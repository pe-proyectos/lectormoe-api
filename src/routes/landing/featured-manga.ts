import { Elysia, t } from 'elysia';
import { getFeaturedManga } from '../../controllers/landing/featured-manga';

export const router = () => new Elysia()
	.get(
		'/api/landing/featured-manga',
		async ({ query }) => {
			const limit = query?.limit ? Number.parseInt(query.limit) : 8;
			const data = await getFeaturedManga(limit);
			return { status: true, data };
		},
		{
			query: t.Optional(
				t.Object({
					limit: t.Optional(t.String()),
				})
			),
			response: t.Object({
				status: t.Boolean(),
				data: t.Array(
				t.Object({
					id: t.String(),
					title: t.String(),
					cover: t.String(),
					scanName: t.String(),
					scanSlug: t.String(),
					scanUrl: t.String(),
					mangaSlug: t.String(),
					mangaUrl: t.String(),
					badgeColor: t.String(),
					chapters: t.Array(
						t.Object({
							id: t.Number(),
							number: t.Number(),
							title: t.String(),
							releasedAt: t.Date(),
							chapterUrl: t.String(),
						})
					),
				})
				),
			}),
		}
	);

