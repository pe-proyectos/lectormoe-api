import { type Static, t } from 'elysia';

export const EditMangaCustomRequest = t.Object({
    mangaCustomId: t.Number(),
    status: t.Optional(t.String()),
    title: t.Optional(t.String()),
    shortDescription: t.Optional(t.String()),
    description: t.Optional(t.String()),
    genreIds: t.Optional(t.Array(t.Number())),
    subscriptionPlanIds: t.Optional(t.Array(t.Number())),
    image: t.Optional(t.Union([t.String(), t.Null()])),
    banner: t.Optional(t.Union([t.String(), t.Null()])),
    releasedAt: t.Optional(t.Union([t.Date(), t.Null(), t.String()])),
    nextChapterAt: t.Optional(t.Union([t.Date(), t.Null(), t.String()])),
    nextChapterAtMessage: t.Optional(t.Union([t.String(), t.Null()])),
    requireLogin: t.Optional(t.Boolean()),
    isSimulRelease: t.Optional(t.Boolean()),
    isNSFW: t.Optional(t.Boolean()),
});

export type EditMangaCustomRequest = Static<typeof EditMangaCustomRequest>;
