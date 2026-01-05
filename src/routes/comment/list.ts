import { Elysia, t } from 'elysia';

import { useOrganizationOptional } from '../../plugins/organization';
import { listComments } from '../../controllers/comment/list';
import { loggedOptional } from '../../plugins/auth';

export const router = () => new Elysia()
    .use(useOrganizationOptional())
    .use(loggedOptional())
    .get(
        '/api/comment',
        async ({ organizationId, user, query: { identifier, admin } }) => {
            // Si no hay organización, retornar lista vacía
            if (!organizationId) {
                return { status: true, data: [] };
            }
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
