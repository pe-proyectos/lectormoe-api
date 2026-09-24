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
						// Elysia descarta lo que no este declarado aqui: sin id, price y
						// tier el ranking no podia ordenar ni agrupar por plan.
						subscriptionPlan: t.Object({
							id: t.Number(),
							name: t.String(),
							price: t.Number(),
							tier: t.Optional(t.Union([t.String(), t.Null()])),
						}),
						subscriptionId: t.Number(),
						legacy: t.Optional(t.Boolean()),
					})),
				}),
				t.Object({
					status: t.Literal(false),
					error: t.String(),
				}),
			])
		}
	);

