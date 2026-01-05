import { Elysia, t } from 'elysia';

import { checkOrganization, checkOrganizationBySlug } from '../../controllers/organization/check';
import { loggedOptional } from '../../plugins/auth';


export const router = () => new Elysia()
    .use(loggedOptional())
    .get(
        '/api/organization/check',
        async ({ query, headers }) => {
            const { domain, slug } = query as { domain?: string; slug?: string };
            
            // Priorizar query params sobre header organization-domain
            // Si hay slug o domain en el query, usarlos; si no, usar el header
            let finalSlug = slug;
            let finalDomain = domain;
            
            if (!finalSlug && !finalDomain) {
                // Si no hay query params, intentar usar el header
                const organizationIdentifier = headers.get('organization-domain');
                if (organizationIdentifier) {
                    // Si contiene un punto, es un domain; si no, es un slug
                    if (organizationIdentifier.includes('.')) {
                        finalDomain = organizationIdentifier;
                    } else {
                        finalSlug = organizationIdentifier;
                    }
                }
            }
            
            if (!finalDomain && !finalSlug) {
                throw new Error('No se recibió el dominio ni el slug.');
            }
            
            let organization;
            if (finalSlug) {
                organization = await checkOrganizationBySlug(finalSlug);
            } else if (finalDomain) {
                organization = await checkOrganization(finalDomain);
            }
            
            if (!organization) {
                throw new Error(`No se encontró la organización '${finalSlug || finalDomain}'.`);
            }
            
            // Include followerCount in response
            const organizationData = {
                ...organization,
                followerCount: organization._count?.followers || 0,
            };
            delete organizationData._count;
            
            return {
                status: true,
                data: organizationData,
            };
        },
        {
            query: t.Object({
                domain: t.Optional(t.String()),
                slug: t.Optional(t.String()),
            }),
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
        }
    );
