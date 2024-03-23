import { Static, t } from 'elysia';

export const EditMangaCustomRequest = t.Object({
    mangaCustomId: t.Number(),
    title: t.Optional(t.String()),
    shortDescription: t.Optional(t.String()),
    description: t.Optional(t.String()),
    image: t.Optional(
        t.Union([
            t.File(),
            t.String(),
        ])
    ),
    releasedAt: t.Optional(t.Date()),
    nextChapterAt: t.Optional(t.Date()),
});

export type EditMangaCustomRequest = Static<typeof EditMangaCustomRequest>;
