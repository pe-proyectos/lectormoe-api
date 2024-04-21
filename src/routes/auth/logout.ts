import { Elysia, t } from 'elysia';

import { deleteToken } from '../../controllers/auth/logout';
import { loggedUserOnly } from '../../plugins/auth';


export const router = () => new Elysia()
    .use(loggedUserOnly())
    .get(
        '/api/auth/logout',
        async ({ organizationId, token }) => {
            await deleteToken(organizationId, token as string);
            return { status: true, message: 'OK' };
        },
        {
            response: t.Object({
                status: t.Boolean(),
                message: t.String(),
            }),
        }
    );
