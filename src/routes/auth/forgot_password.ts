import { Elysia, t } from 'elysia';

import { forgotPassword } from '../../controllers/auth/forgot_password';
import { checkOrganizationBySlug } from '../../controllers/organization/check';
import { prisma, Prisma } from '../../models/prisma';
import { rateLimiter, RATE_LIMITS } from '../../util/rate-limiter';

export const router = () => new Elysia()
    .post(
        '/api/auth/forgot-password',
        async ({ request: { headers }, body, set }) => {
            const { email } = body;

            if (!email) {
                throw new Error('El correo electrónico es requerido.');
            }

            // SECURITY: Rate limiting - Prevent password reset abuse
            const rateLimitKey = `forgot-password:${email}`;
            const rateLimit = rateLimiter.checkLimit(
                rateLimitKey,
                RATE_LIMITS.PASSWORD_RESET.maxRequests,
                RATE_LIMITS.PASSWORD_RESET.windowMs
            );

            if (!rateLimit.allowed) {
                set.status = 429;
                const resetInMinutes = Math.ceil((rateLimit.resetAt - Date.now()) / 60000);
                return {
                    status: false,
                    message: `Demasiados intentos de restablecimiento. Por favor intenta de nuevo en ${resetInMinutes} minutos.`
                };
            }

            // Obtener organizationId si se proporciona x-organization
            let organizationId: number | null = null;
            let organizationName = 'Capibara Traductor';
            const organizationIdentifier = headers.get('x-organization');
            
            if (organizationIdentifier) {
                const organization = await checkOrganizationBySlug(organizationIdentifier);
                
                if (organization) {
                    organizationId = organization.id;
                    organizationName = organization.name;
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
                    organizationName = defaultOrg.name;
                } else {
                    throw new Error('No se pudo determinar la organización para el restablecimiento de contraseña.');
                }
            }

            await forgotPassword(
                organizationId,
                organizationName, 
                email as string
            );

            return {
                status: true,
                message: 'Se ha enviado un correo electrónico con el código de restablecimiento.'
            };
        },
        {
            body: t.Object({
                email: t.String()
            }),
            response: t.Object({
                status: t.Boolean(),
                message: t.String()
            })
        }
    );
