import { Elysia, t } from 'elysia';

import { checkToken } from '../../controllers/auth/check';
import { authMiddleware } from '../../plugins/auth';


export const router = () => new Elysia()
    .use(authMiddleware({ loggedOnly: false }))
    .get(
        '/api/auth/check',
        async ({ token }) => {
            const user = await checkToken(token as string);
            if (!token) {
                throw new Error('No se pudo verificar la sesión.');
            }
            if (!user) {
                throw new Error('No se pudo verificar la sesión.');
            }
            return {
                status: true,
                data: {
                    token,
                    username: user.username,
                    user_slug: user.slug,
                }
            };
        },
        {
            response: t.Object({
                status: t.Boolean(),
                data: t.Object({
                    token: t.String(),
                    username: t.String(),
                    user_slug: t.String(),
                }),
            }),
        }
    );
