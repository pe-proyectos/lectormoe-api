import { Elysia, t } from 'elysia';

import { listTransactions } from '../../controllers/transactions/list';
import { useOrganization } from '../../plugins/organization';

export const router = () => new Elysia()
    .use(useOrganization())
    .get(
        '/api/transactions',
        async ({ organizationId }) => {
            const { data } = await listTransactions(organizationId);
            
            return { status: true, data };
        },
        {
            response: t.Object({
                status: t.Boolean(),
                data: t.Array(t.Any()),
            }),
        }
    );
