import { Elysia, t } from 'elysia';
import { getGlobalTopReaders } from '../../controllers/landing/top-readers';

export const router = () => new Elysia()
	.get(
		'/api/landing/top-readers',
		async () => {
			const data = await getGlobalTopReaders();
			return { status: true, data };
		},
		{
			response: t.Object({
				status: t.Boolean(),
				data: t.Array(t.Object({
					id: t.Number(),
					username: t.String(),
					slug: t.String(),
					imageUrl: t.Union([t.String(), t.Null()]),
					chaptersRead: t.Number(),
				})),
			}),
		}
	);
