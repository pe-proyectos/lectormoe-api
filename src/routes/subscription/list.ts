import { Elysia, t } from 'elysia';

import { listSubscriptionPlans } from '../../controllers/subscription_plan/list';
import { useOrganization } from '../../plugins/organization';
import { SubscriptionPlanListQuery } from '../../types/subscription_plan/list';

export const router = () => new Elysia()
    .use(useOrganization())
    .get(
        '/api/subscription-plan',
        async ({ organizationId, query }) => {
            const { data, maxPage, total } = await listSubscriptionPlans(organizationId, query);
            
            return { status: true, data: {
                items: data,
                maxPage,
                total,
            } };
        },
        {
            query: SubscriptionPlanListQuery,
            response: t.Object({
                status: t.Boolean(),
                data: t.Object({
                    data: t.Array(t.Any()),
                    maxPage: t.Number(),
                    total: t.Number(),
                }),
            }),
        }
    );
