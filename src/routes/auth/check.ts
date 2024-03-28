import { Elysia, t } from 'elysia';

import { checkToken } from '../../controllers/auth/check';
import { loggedOptional } from '../../plugins/auth';

export const router = () => new Elysia()
    .use(loggedOptional())
    .get(
        '/api/auth/check',
        async ({ token, organizationId }) => {
            const user = await checkToken(token as string, organizationId as number);
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
                    userSlug: user.slug,
                    member: user?.members?.[0],
                }
            };
        },
        {
            response: t.Object({
                status: t.Boolean(),
                data: t.Object({
                    token: t.String(),
                    username: t.String(),
                    userSlug: t.String(),
                    member: t.Any(),
                }),
            }),
        }
    );
