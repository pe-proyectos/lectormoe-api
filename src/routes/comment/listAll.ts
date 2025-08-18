import { Elysia, t } from 'elysia';

import { useOrganization } from '../../plugins/organization';
import { listAllComments } from '../../controllers/comment/listAll';
import { loggedUserOnly } from '../../plugins/auth';

export const router = () => new Elysia()
    .use(useOrganization())
    .use(loggedUserOnly())
    .get(
        '/api/comment/admin',
        async ({ organizationId, user }) => {
            // Verificar permisos de admin
            if (!user.canHideComment) {
                throw new Error("No tiene permisos para acceder a esta información.");
            }
            
            const data = await listAllComments(organizationId, user.id);
            return { status: true, data };
        },
        {
            response: t.Object({
                status: t.Boolean(),
                data: t.Array(t.Any()),
            }),
        }
    );
