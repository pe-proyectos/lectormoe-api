import { Elysia, t } from 'elysia';

import { listGenre } from '../../controllers/genre/list';
import { useOrganization } from '../../plugins/organization';

export const router = () => new Elysia()
    .use(useOrganization())
    .get(
        '/api/genre',
        async ({ organizationId }) => {
            const data = await listGenre(organizationId);
            return { status: true, data };
        },
        {
            response: t.Object({
                status: t.Boolean(),
                data: t.Array(t.Any()),
            }),
        }
    );
