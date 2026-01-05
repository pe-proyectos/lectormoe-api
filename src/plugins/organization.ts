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
        const organizationIdentifier = headers.get('organization-domain');
        if (!organizationIdentifier) {
            throw new Error('No autorizado, dominio de organización no encontrado.');
        }
        
        // Si contiene un punto, es un domain; si no, es un slug
        const isDomain = organizationIdentifier.includes('.');
        const organization = isDomain 
            ? await checkOrganization(organizationIdentifier)
            : await checkOrganizationBySlug(organizationIdentifier);
            
        if (!organization) {
            throw new Error('No autorizado, organización no encontrada.');
        }
        return { organizationId: organization.id, organization };
    });

// Plugin opcional que permite que organizationId sea null cuando no hay organization-domain
export const useOrganizationOptional = () => new Elysia()
    .use(
        jwt({
            name: 'jwt',
            secret: Bun.env.JWT_SECRET as string,
        })
    )
    .derive({ as: 'global' }, async ({ request: { headers } }) => {
        const organizationIdentifier = headers.get('organization-domain');
        if (!organizationIdentifier) {
            return { organizationId: null, organization: null };
        }
        
        // Si contiene un punto, es un domain; si no, es un slug
        const isDomain = organizationIdentifier.includes('.');
        const organization = isDomain 
            ? await checkOrganization(organizationIdentifier)
            : await checkOrganizationBySlug(organizationIdentifier);
            
        if (!organization) {
            return { organizationId: null, organization: null };
        }
        return { organizationId: organization.id, organization };
    });