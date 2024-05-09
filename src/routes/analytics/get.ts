import { Elysia, t } from 'elysia';

import { useOrganization } from '../../plugins/organization';
import { getAnalytics } from '../../controllers/analytics/get';
import { GetAnalyticsQuery } from '../../types/analytics/get';

export const router = () => new Elysia()
    .use(useOrganization())
    .get(
        '/api/analytics',
        async ({ organizationId, query }) => {
            const result = await getAnalytics(organizationId, query);

            return {
                status: true,
                data: result
            };
        },
        {
            query: GetAnalyticsQuery,
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
        }
    );
