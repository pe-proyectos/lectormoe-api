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
    enableSubscriptionSection: t.Optional(t.Boolean()),
    enableMainSlider: t.Optional(t.Boolean()),
    enableMainBanner: t.Optional(t.Boolean()),


    enableDiscordWebhookNewChapter: t.Optional(t.Boolean()),
    discordWebhookUrlNewChapter:t.Optional(t.String()),
    discordWebhookMessageTemplateNewChapter:t.Optional(t.String()),
    

    enableDiscordWebhookNewSubscription: t.Optional(t.Boolean()),
    discordWebhookUrlNewSubscription:t.Optional(t.String()),
    discordWebhookMessageTemplateNewSubscription:t.Optional(t.String()),

    
    useBlockedCountries: t.Optional(t.Boolean()),
    useAllowedCountries: t.Optional(t.Boolean()),
    countryOptions: t.Optional(t.Array(t.Object({
        countryCode: t.String(),
        language: t.String(),
        countryName: t.String(),
        allowed: t.Boolean(),
        blocked: t.Boolean(),
    }))),
    // Integrations
    enableAds: t.Optional(t.Boolean()),
    enableGoogleAds: t.Optional(t.Boolean()),
    enableAdsterraAds: t.Optional(t.Boolean()),
    isNSFW: t.Optional(t.Boolean()),
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
    // Images - Solo recibimos fileKeys (strings) o null, no Files
    logo: t.Optional(t.Union([t.String(), t.Null()])),
    image: t.Optional(t.Union([t.String(), t.Null()])),
    banner: t.Optional(t.Union([t.String(), t.Null()])),
    favicon: t.Optional(t.Union([t.String(), t.Null()])),
});

export type EditOrganizationRequest = Static<typeof EditOrganizationRequest>;
