import { type Static, t } from 'elysia';

export const EditMangaCustomRequest = t.Object({
    mangaCustomId: t.Number(),
    status: t.Optional(t.Union([t.String(), t.Null()])),
    title: t.Optional(t.Union([t.String(), t.Null()])),
    shortDescription: t.Optional(t.Union([t.String(), t.Null()])),
    description: t.Optional(t.Union([t.String(), t.Null()])),
    genreIds: t.Optional(t.Union([t.Array(t.Number()), t.Null()])),
    subscriptionPlanIdsCanReadUnreleased: t.Optional(t.Union([t.Array(t.Number()), t.Null()])),
    subscriptionPlanIdsCanReadReleased: t.Optional(t.Union([t.Array(t.Number()), t.Null()])),
    image: t.Optional(t.Union([t.String(), t.Null()])),
    banner: t.Optional(t.Union([t.String(), t.Null()])),
    releasedAt: t.Optional(t.Union([t.Date(), t.Null(), t.String()])),
    nextChapterAt: t.Optional(t.Union([t.Date(), t.Null(), t.String()])),
    nextChapterAtMessage: t.Optional(t.Union([t.String(), t.Null()])),
    requireLogin: t.Optional(t.Union([t.Boolean(), t.Null()])),
    isSimulRelease: t.Optional(t.Union([t.Boolean(), t.Null()])),
    isNSFW: t.Optional(t.Union([t.Boolean(), t.Null()])),
});

export type EditMangaCustomRequest = Static<typeof EditMangaCustomRequest>;
