import { Elysia, t } from 'elysia';

import { listCoinPacks } from '../../controllers/coinpack/list';
import { useOrganization } from '../../plugins/organization';
import { CoinPackListQuery } from '../../types/coinpack/list';

export const router = () => new Elysia()
    .use(useOrganization())
    .get(
        '/api/coinpack',
        async ({ organizationId, query }) => {
            const { data, maxPage, total } = await listCoinPacks(organizationId, query);
            
            return { status: true, data: {
                data,
                maxPage,
                total,
            } };
        },
        {
            query: CoinPackListQuery,
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
