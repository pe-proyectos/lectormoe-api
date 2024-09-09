import { Static, t } from 'elysia';

export const EditOrganizationRequest = t.Object({
    // Information
    name: t.Optional(t.String()),
    title: t.Optional(t.String()),
    description: t.Optional(t.String()),
    language: t.Optional(t.String()),
    enableMangaSection: t.Optional(t.Boolean()),
    enableManhuaSection: t.Optional(t.Boolean()),
    enableManhwaSection: t.Optional(t.Boolean()),
    useBlockedCountries: t.Optional(t.Boolean()),
    useAllowedCountries: t.Optional(t.Boolean()),
    countryOptions: t.Array(t.Object({
        countryCode: t.String(),
        language: t.String(),
        countryName: t.String(),
        allowed: t.Boolean(),
        blocked: t.Boolean(),
    })),
    // Integrations
    enableGoogleAds: t.Optional(t.Boolean()),
    enableDisqusIntegration: t.Optional(t.Boolean()),
    disqusEmbedUrl: t.Optional(t.String()),
    monitorWebsiteId: t.Optional(t.String()),
    // Social
    facebookUrl: t.Optional(t.String()),
    twitterUrl: t.Optional(t.String()),
    instagramUrl: t.Optional(t.String()),
    youtubeUrl: t.Optional(t.String()),
    patreonUrl: t.Optional(t.String()),
    tiktokUrl: t.Optional(t.String()),
    discordUrl: t.Optional(t.String()),
    twitchUrl: t.Optional(t.String()),
    // Images
    logo: t.Optional(
        t.Union([
            t.File({
                maxSize: '25m',
            }),
            t.String(),
        ])
    ),
    image: t.Optional(
        t.Union([
            t.File({
                maxSize: '25m',
            }),
            t.String(),
        ])
    ),
    banner: t.Optional(
        t.Union([
            t.File({
                maxSize: '25m',
            }),
            t.String(),
        ])
    ),
    favicon: t.Optional(
        t.Union([
            t.File({
                maxSize: '25m',
            }),
            t.String(),
        ])
    ),
});

export type EditOrganizationRequest = Static<typeof EditOrganizationRequest>;
