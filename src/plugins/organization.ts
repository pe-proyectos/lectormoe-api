import jwt from '@elysiajs/jwt';
import { Elysia } from 'elysia';
import { checkOrganization, checkOrganizationBySlug } from '../controllers/organization/check';

export const useOrganization = () => new Elysia()
    .use(
        jwt({
            name: 'jwt',
            secret: Bun.env.JWT_SECRET as string,
        })
    )
    .derive({ as: 'global' }, async ({ request: { headers } }) => {
        const organizationIdentifier = headers.get('x-organization');
        if (!organizationIdentifier) {
            throw new Error('No autorizado, dominio de organización no encontrado.');
        }
        
        const organization = await checkOrganizationBySlug(organizationIdentifier);
            
        if (!organization) {
            throw new Error('No autorizado, organización no encontrada.');
        }
        return { organizationId: organization.id, organization };
    });

// Plugin opcional que permite que organizationId sea null cuando no hay x-organization
export const useOrganizationOptional = () => new Elysia()
    .use(
        jwt({
            name: 'jwt',
            secret: Bun.env.JWT_SECRET as string,
        })
    )
    .derive({ as: 'global' }, async ({ request: { headers } }) => {
        const organizationIdentifier = headers.get('x-organization');
        if (!organizationIdentifier) {
            return { organizationId: null, organization: null };
        }
        
        const organization = await checkOrganizationBySlug(organizationIdentifier);
            
        if (!organization) {
            return { organizationId: null, organization: null };
        }
        return { organizationId: organization.id, organization };
    });