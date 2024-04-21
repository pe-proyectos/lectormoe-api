import jwt from '@elysiajs/jwt';
import { Elysia, t } from 'elysia';

import { login } from '../../controllers/auth/login';
import { createToken } from '../../controllers/auth/token';
import { useOrganization } from '../../plugins/organization';


export const router = () => new Elysia()
    .use(useOrganization())
    .use(
        jwt({
            name: 'jwt',
            secret: Bun.env.JWT_SECRET as string,
        })
    )
    .post(
        '/api/auth/login',
        async ({ organizationId, jwt, body: { email, password } }) => {
            const user = await login(organizationId, email, password);

            if (!user) {
                throw new Error('No se pudo iniciar sesión.');
            }

            const token = await jwt.sign({ userId: user.id });

            const tokenCreated = await createToken(token, user.id);

            return {
                status: true,
                data: {
                    token: tokenCreated.token,
                    username: user.username,
                    userSlug: user.slug,
                }
            };
        },
        {
            body: t.Object({
                email: t.String(),
                password: t.String({
                    minLength: 4,
                    maxLength: 30,
                    error: 'La contraseña debe tener entre 4 y 30 caracteres.',
                }),
            }),
            response: t.Object({
                status: t.Boolean(),
                data: t.Object({
                    token: t.String(),
                    username: t.String(),
                    userSlug: t.String(),
                }),
            }),
        }
    );
