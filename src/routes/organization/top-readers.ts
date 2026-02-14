import { Elysia, t } from 'elysia';
import { getTopReaders } from '../../controllers/organization/top-readers';
import { checkOrganizationBySlug } from '../../controllers/organization/check';

export const router = () => new Elysia()
	.get(
		'/api/organization/:slug/top-readers',
		async ({ params }) => {
			try {
				const { slug } = params;

				const organization = await checkOrganizationBySlug(slug);
				if (!organization) {
					throw new Error('Organización no encontrada.');
				}

				const readers = await getTopReaders(organization.id);

				return { status: true, data: readers };
			} catch (error) {
				console.error('Error fetching top readers:', error);
				return { status: false, error: error instanceof Error ? error.message : 'Internal server error' };
			}
		},
		{
			params: t.Object({
				slug: t.String(),
			}),
			response: t.Union([
				t.Object({
					status: t.Literal(true),
					data: t.Array(t.Object({
						id: t.Number(),
						username: t.String(),
						slug: t.String(),
						imageUrl: t.Union([t.String(), t.Null()]),
						chaptersRead: t.Number(),
					})),
				}),
				t.Object({
					status: t.Literal(false),
					error: t.String(),
				}),
			])
		}
	);
