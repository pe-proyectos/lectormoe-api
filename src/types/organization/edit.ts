import { Static, t } from 'elysia';

export const EditOrganizationRequest = t.Object({
    // Information
    name: t.Optional(t.String()),
    title: t.Optional(t.String()),
    description: t.Optional(t.String()),
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
            t.File(),
            t.String(),
        ])
    ),
    image: t.Optional(
        t.Union([
            t.File(),
            t.String(),
        ])
    ),
    banner: t.Optional(
        t.Union([
            t.File(),
            t.String(),
        ])
    ),
});

export type EditOrganizationRequest = Static<typeof EditOrganizationRequest>;
