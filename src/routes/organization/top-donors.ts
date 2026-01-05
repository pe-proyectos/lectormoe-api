import { Elysia, t } from 'elysia';
import { getTopDonors } from '../../controllers/organization/top-donors';
import { checkOrganizationBySlug } from '../../controllers/organization/check';

export const router = () => new Elysia()
	.get(
		'/api/organization/:slug/top-donors',
		async ({ params }) => {
			try {
				const { slug } = params;
				
				const organization = await checkOrganizationBySlug(slug);
				if (!organization) {
					throw new Error('Organización no encontrada.');
				}
				
				const donors = await getTopDonors(organization.id);
				
				return { status: true, data: donors };
			} catch (error) {
				console.error('Error fetching top donors:', error);
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
						days: t.Number(),
						subscriptionPlan: t.Object({
							name: t.String(),
						}),
						subscriptionId: t.Number(),
					})),
				}),
				t.Object({
					status: t.Literal(false),
					error: t.String(),
				}),
			])
		}
	);

