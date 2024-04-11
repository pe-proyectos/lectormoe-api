import jwt from '@elysiajs/jwt';
import { Elysia } from 'elysia';
import { checkOrganization } from '../controllers/organization/check';

export const useOrganization = () => new Elysia()
    .use(
        jwt({
            name: 'jwt',
            secret: Bun.env.JWT_SECRET as string,
        })
    )
    .derive({ as: 'global' }, async ({ request: { headers } }) => {
        const organizationDomain = headers.get('organization-domain');
        if (!organizationDomain) {
            throw new Error('No autorizado, dominio de organización no encontrado.');
        }
        const organization = await checkOrganization(organizationDomain);
        if (!organization) {
            throw new Error('No autorizado, organización no encontrada.');
        }
        return { organizationId: organization.id };
    });
