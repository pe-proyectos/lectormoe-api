import { Elysia, t } from 'elysia';

import { loggedOptional } from '../../plugins/auth';
import { recordDailyActivity } from '../../controllers/user/daily-activity';

export const router = () => new Elysia()
    .use(loggedOptional())
    .get(
        '/api/auth/check',
        async ({ logged, user, token, request: { headers } }) => {
            // Si no hay token o el usuario no está logueado, retornar status: false
            if (!token || !user || !logged) {
                return {
                    status: false,
                    message: 'Sesión no válida',
                };
            }

            // Record daily activity (fire-and-forget, don't block response)
            recordDailyActivity(user.id).catch(() => {});

            return {
                status: true,
                data: {
                    token: token as string,
                    user: user,
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
                    }),
                }),
                t.Object({
                    status: t.Boolean(),
                    message: t.String(),
                }),
            ]),
        }
    );
