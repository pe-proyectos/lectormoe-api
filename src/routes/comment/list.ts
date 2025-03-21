import { Elysia, t } from 'elysia';

import { useOrganization } from '../../plugins/organization';
import { listComments } from '../../controllers/comment/list';

export const router = () => new Elysia()
    .use(useOrganization())
    .get(
        '/api/comment',
        async ({ organizationId, query: { identifier } }) => {
            const data = await listComments(organizationId, identifier);
            return { status: true, data };
        },
        {
            response: t.Object({
                status: t.Boolean(),
                data: t.Array(t.Any()),
            }),
        }
    );
