import { Elysia, t } from 'elysia';

import { listSubscriptionModels } from '../../controllers/subscription-model/list';
import { useOrganization } from '../../plugins/organization';
import { SubscriptionModelListQuery } from '../../types/subscription-model/list';

export const router = () => new Elysia()
    .use(useOrganization())
    .get(
        '/api/subscription-model',
        async ({ organizationId, query }) => {
            const { data, maxPage, total } = await listSubscriptionModels(organizationId, query);
            
            return { status: true, data: {
                data,
                maxPage,
                total,
            } };
        },
        {
            query: SubscriptionModelListQuery,
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
        }
    );
