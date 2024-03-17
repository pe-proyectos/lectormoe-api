import { Elysia, t } from 'elysia';

import { checkOrganization } from '../../controllers/organization/check';
import { authMiddleware } from '../../plugins/auth';


export const router = () => new Elysia()
    .use(authMiddleware({ loggedOnly: false }))
    .get(
        '/api/organization/check',
        async ({ query: { domain } }) => {
            if (!domain) {
                throw new Error('No se recibió el dominio.');
            }
            const organization = await checkOrganization(domain, '');
            if (!organization) {
                throw new Error(`No se encontró la organización '${domain}'.`);
            }
            return {
                status: true,
                data: organization,
            };
        },
        {
            query: t.Object({
                domain: t.String(),
            }),
            response: t.Object({
                status: t.Boolean(),
                data: t.Object({
                    id: t.Number(),
                    name: t.String(),
                    slug: t.String(),
                    title: t.String(),
                    imageUrl: t.String(),
                    description: t.String(),
                    googleAdsMetaContent: t.Nullable(t.String()),
                    googleAdsAdsTxtContent: t.Nullable(t.String()),
                }),
            }),
        }
    );
