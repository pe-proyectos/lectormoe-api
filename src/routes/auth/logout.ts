import { Elysia, t } from 'elysia';

import { deleteToken } from '../../controllers/auth/logout';
import { authMiddleware } from '../../plugins/auth';


export const router = () => new Elysia()
    .use(authMiddleware({ loggedOnly: true }))
    .get(
        '/api/auth/logout',
        async ({ token }) => {
            await deleteToken(token as string);
            return { status: true, message: 'OK' };
        },
        {
            response: t.Object({
                status: t.Boolean(),
                message: t.String(),
            }),
        }
    );
