import jwt from '@elysiajs/jwt';
import { Elysia, t } from 'elysia';

import { register } from '../../controllers/auth/register';
import { checkOrganizationBySlug } from '../../controllers/organization/check';
import { prisma, Prisma } from '../../models/prisma';
import { rateLimiter, RATE_LIMITS } from '../../util/rate-limiter';


export const router = () => new Elysia()
    .use(
        jwt({
            name: 'jwt',
            secret: Bun.env.JWT_SECRET as string,
        })
    )
    .post(
        '/api/auth/register',
        async ({ request: { headers }, body: { email, username, password }, set }) => {
            // SECURITY: Rate limiting - Prevent mass account creation
            const clientIp = headers.get('x-forwarded-for') || headers.get('x-real-ip') || 'unknown';
            const rateLimitKey = `register:${clientIp}`;
            const rateLimit = rateLimiter.checkLimit(
                rateLimitKey,
                RATE_LIMITS.REGISTRATION.maxRequests,
                RATE_LIMITS.REGISTRATION.windowMs
            );

            if (!rateLimit.allowed) {
                set.status = 429;
                const resetInMinutes = Math.ceil((rateLimit.resetAt - Date.now()) / 60000);
                return {
                    status: false,
                    error: `Demasiados intentos de registro. Por favor intenta de nuevo en ${resetInMinutes} minutos.`,
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

            // Si no hay organizationId, usar la primera organización pública como predeterminada
            if (!organizationId) {
                const defaultOrg = await prisma.organization.findFirst({
                    where: { isPublic: true },
                    orderBy: { id: Prisma.SortOrder.asc },
                });
                if (defaultOrg) {
                    organizationId = defaultOrg.id;
                } else {
                    throw new Error('No se pudo determinar la organización para el registro.');
                }
            }

            const registered = await register(organizationId, email, username, password);

            if (!registered) {
                throw new Error('No se pudo registrar el usuario.');
            }

            return {
                status: true,
                data: {
                    registered
                }
            };
        },
        {
            body: t.Object({
                email: t.String({
                    format: 'email',
                    default: '',
                    error: 'El email no es válido.',
                }),
                username: t.String({
                    minLength: 3,
                    maxLength: 20,
                    pattern: '^[a-zA-Z0-9_]*$',
                    default: '',
                    error: 'El nombre de usuario debe tener entre 3 y 20 caracteres alfanuméricos.',
                }),
                password: t.String({
                    minLength: 4,
                    maxLength: 30,
                    error: 'La contraseña debe tener entre 4 y 30 caracteres.',
                }),
            }),
            response:  t.Object({
                status: t.Boolean(),
                data: t.Object({
                    registered: t.Boolean(),
                }),
            }),
        }
    );
