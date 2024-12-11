import { Elysia, t } from 'elysia';

import { checkToken } from '../../controllers/auth/check';
import { loggedOptional } from '../../plugins/auth';

export const router = () => new Elysia()
    .use(loggedOptional())
    .get(
        '/api/auth/check',
        async ({ organizationId, token }) => {
            const user = await checkToken(organizationId as number, token as string);
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
                    user,
                }
            };
        },
        {
            response: t.Object({
                status: t.Boolean(),
                data: t.Object({
                    token: t.String(),
                    user: t.Any(),
                }),
            }),
        }
    );
