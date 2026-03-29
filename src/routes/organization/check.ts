import { Elysia, t } from 'elysia';

import { checkOrganization, checkOrganizationBySlug } from '../../controllers/organization/check';
import { loggedOptional } from '../../plugins/auth';
import { prisma } from '../../models/prisma';


export const router = () => new Elysia()
    .use(loggedOptional())
    .get(
        '/api/organization/check',
        async ({ query, headers }) => {
            const { domain, slug } = query as { domain?: string; slug?: string };
            
            // Priorizar query params sobre header x-organization
            // Si hay slug o x-organization en el query, usarlos; si no, usar el header
            let finalSlug = slug;
            let finalDomain = domain;
            
            if (!finalSlug && !finalDomain) {
                // Si no hay query params, intentar usar el header
                const organizationIdentifier = headers.get('x-organization');
                if (organizationIdentifier) {
                    // Si contiene un punto, es un domain; si no, es un slug
                    if (organizationIdentifier.includes('.')) {
                        finalDomain = organizationIdentifier;
                    } else {
                        finalSlug = organizationIdentifier;
                    }
                }
            }
            
            if (!finalSlug) {
                throw new Error('No se recibió el domain slug.');
            }
            
            let organization = await checkOrganizationBySlug(finalSlug);
            
            if (!organization) {
                throw new Error(`No se encontró la organización '${finalSlug || finalDomain}'.`);
            }
            
            const nsfwMangaCount = await prisma.mangaCustom.count({
                where: { organizationId: organization.id, isNSFW: true },
            });

            // Include followerCount, mangaCount, nsfwMangaCount in response
            const organizationData = {
                ...organization,
                followerCount: organization._count?.followers || 0,
                mangaCount: organization._count?.mangaCustoms || 0,
                nsfwMangaCount,
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
