import { Elysia, t } from 'elysia';
import { useOrganization } from '../../plugins/organization';
import { getEngagementStatistics } from '../../controllers/analytics/engagement-statistics';

export const router = () => new Elysia()
	.use(useOrganization())
	.get(
		'/api/engagement-statistics',
		async ({ organizationId, query }) => {
			const from = query.from ? new Date(query.from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
			const to = query.to ? new Date(query.to) : new Date();
			from.setHours(0, 0, 0, 0);
			to.setHours(23, 59, 59, 999);

			const data = await getEngagementStatistics(organizationId, from, to);
			return { status: true, data };
		},
		{
			query: t.Optional(t.Object({
				from: t.Optional(t.String()),
				to: t.Optional(t.String()),
			})),
			response: t.Object({
				status: t.Boolean(),
				data: t.Any(),
			}),
		}
	);
