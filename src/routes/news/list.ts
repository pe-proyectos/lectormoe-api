import { Elysia, t } from 'elysia';

import { useOrganization } from '../../plugins/organization';
import { listNews } from '../../controllers/news/list';

export const router = () => new Elysia()
    .use(useOrganization())
    .get(
        '/api/news',
        async ({ organizationId, query }) => {
            const data = await listNews(organizationId, query);
            return { status: true, data };
        },
        {
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
        }
    );
