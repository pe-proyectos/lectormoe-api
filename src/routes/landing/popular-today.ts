import { Elysia, t } from 'elysia';
import { getPopularToday } from '../../controllers/landing/popular-today';

export const router = () => new Elysia()
	.get(
		'/api/landing/popular-today',
		async ({ query }) => {
			const limit = query?.limit ? Number.parseInt(query.limit) : 5;
			const nsfw = query?.nsfw === 'true' ? true : query?.nsfw === 'false' ? false : undefined;
			const data = await getPopularToday(limit, nsfw);
			return { status: true, data };
		},
		{
			query: t.Optional(
				t.Object({
					limit: t.Optional(t.String()),
					nsfw: t.Optional(t.String()),
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
