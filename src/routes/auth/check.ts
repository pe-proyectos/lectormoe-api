import { Elysia, t } from 'elysia';

import { checkToken } from '../../controllers/auth/check';
import { loggedOptional } from '../../plugins/auth';
import { checkOrganization, checkOrganizationBySlug } from '../../controllers/organization/check';

export const router = () => new Elysia()
    .use(loggedOptional())
    .get(
        '/api/auth/check',
        async ({ logged, user, token, permissions, request: { headers } }) => {
            // Si no hay token o el usuario no está logueado, retornar status: false
            if (!token || !user || !logged) {
                return {
                    status: false,
                    message: 'Sesión no válida',
                };
            }

            return {
                status: true,
                data: {
                    token: token as string,
                    user: user,
                    permissions: permissions || null,
                }
            };
        },
        {
            response: t.Union([
                t.Object({
                    status: t.Boolean(),
                    data: t.Object({
                        token: t.String(),
                        user: t.Any(),
                        permissions: t.Nullable(t.Any()),
                    }),
                }),
                t.Object({
                    status: t.Boolean(),
                    message: t.String(),
                }),
            ]),
        }
    );
