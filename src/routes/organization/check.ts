import { Elysia, t } from 'elysia';

import { checkOrganization } from '../../controllers/organization/check';
import { loggedOptional } from '../../plugins/auth';


export const router = () => new Elysia()
    .use(loggedOptional())
    .get(
        '/api/organization/check',
        async ({ query: { domain } }) => {
            if (!domain) {
                throw new Error('No se recibió el dominio.');
            }
            const organization = await checkOrganization(domain);
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
                    imageUrl: t.Nullable(t.String()),
                    description: t.Nullable(t.String()),
                    enableGoogleAds: t.Boolean(),
                    googleAdsMetaContent: t.Nullable(t.String()),
                    googleAdsAdsTxtContent: t.Nullable(t.String()),
                    enableDisqusIntegration: t.Boolean(),
                    disqusEmbedUrl: t.Nullable(t.String()),
                    facebookUrl: t.Nullable(t.String()),
                    twitterUrl: t.Nullable(t.String()),
                    instagramUrl: t.Nullable(t.String()),
                    youtubeUrl: t.Nullable(t.String()),
                    patreonUrl: t.Nullable(t.String()),
                    tiktokUrl: t.Nullable(t.String()),
                    discordUrl: t.Nullable(t.String()),
                    twitchUrl: t.Nullable(t.String()),
                    createdAt: t.Date(),
                    updatedAt: t.Date(),
                }),
            }),
        }
    );
