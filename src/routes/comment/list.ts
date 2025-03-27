import { Elysia, t } from 'elysia';

import { useOrganization } from '../../plugins/organization';
import { listComments } from '../../controllers/comment/list';
import { loggedOptional } from '../../plugins/auth';

export const router = () => new Elysia()
    .use(useOrganization())
    .use(loggedOptional())
    .get(
        '/api/comment',
        async ({ organizationId, user, query: { identifier, admin } }) => {
            const data = await listComments(organizationId, identifier, admin?.toString() === 'true', user?.id);
            return { status: true, data };
        },
        {
            response: t.Object({
                status: t.Boolean(),
                data: t.Array(t.Any()),
            }),
        }
    );
