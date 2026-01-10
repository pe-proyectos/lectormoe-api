import jwt from '@elysiajs/jwt';
import { Elysia, t } from 'elysia';

import { login } from '../../controllers/auth/login';
import { createToken } from '../../controllers/auth/token';
import { checkOrganization, checkOrganizationBySlug } from '../../controllers/organization/check';
import { rateLimiter, RATE_LIMITS } from '../../util/rate-limiter';


export const router = () => new Elysia()
    .use(
        jwt({
            name: 'jwt',
            secret: Bun.env.JWT_SECRET as string,
        })
    )
    .post(
        '/api/auth/login',
        async ({ jwt, request: { headers }, body: { email, password }, set }) => {
            // SECURITY: Rate limiting - Prevent brute force attacks
            const clientIp = headers.get('x-forwarded-for') || headers.get('x-real-ip') || 'unknown';
            const rateLimitKey = `login:${clientIp}:${email}`;
            const rateLimit = rateLimiter.checkLimit(
                rateLimitKey,
                RATE_LIMITS.AUTH_LOGIN.maxRequests,
                RATE_LIMITS.AUTH_LOGIN.windowMs
            );

            if (!rateLimit.allowed) {
                set.status = 429;
                const resetInMinutes = Math.ceil((rateLimit.resetAt - Date.now()) / 60000);
                return {
                    status: false,
                    error: `Demasiados intentos de inicio de sesión. Por favor intenta de nuevo en ${resetInMinutes} minutos.`,
                    resetAt: rateLimit.resetAt
                };
            }

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

            // SECURITY: Reset rate limit on successful login
            rateLimiter.reset(rateLimitKey);

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
