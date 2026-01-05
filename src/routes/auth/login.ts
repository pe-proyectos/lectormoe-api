import jwt from '@elysiajs/jwt';
import { Elysia, t } from 'elysia';

import { login } from '../../controllers/auth/login';
import { createToken } from '../../controllers/auth/token';
import { checkOrganization, checkOrganizationBySlug } from '../../controllers/organization/check';


export const router = () => new Elysia()
    .use(
        jwt({
            name: 'jwt',
            secret: Bun.env.JWT_SECRET as string,
        })
    )
    .post(
        '/api/auth/login',
        async ({ jwt, request: { headers }, body: { email, password } }) => {
            // Obtener organizationId si se proporciona x-organization
            let organizationId: number | null = null;
            const organizationIdentifier = headers.get('x-organization');
            
            if (organizationIdentifier) {
                const organization = await checkOrganizationBySlug(organizationIdentifier);
                
                if (organization) {
                    organizationId = organization.id;
                }
            }

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
                    user,
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
                    user: t.Any(),
                }),
            }),
        }
    );
