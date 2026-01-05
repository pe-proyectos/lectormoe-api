import { Elysia, t } from 'elysia';
import { getScans } from '../../controllers/landing/scans';

export const router = () => new Elysia()
	.get(
		'/api/landing/scans',
		async ({ query }) => {
			const includeNSFW = query?.includeNSFW === 'true';
			const data = await getScans(includeNSFW);
			return { status: true, data };
		},
		{
			query: t.Optional(
				t.Object({
					includeNSFW: t.Optional(t.String()),
				})
			),
			response: t.Object({
				status: t.Boolean(),
				data: t.Array(
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
			}),
		}
	);

