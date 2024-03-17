import { Static, t } from 'elysia';

export const CreateMangaCustomRequest = t.Object({
    title: t.String(),
    mangaId: t.Number(),
    shortDescription: t.String(),
    description: t.String(),
    image: t.File(),
    releasedAt: t.Optional(t.Date()),
    nextChapterAt: t.Optional(t.Date()),
});

export type CreateMangaCustomRequest = Static<typeof CreateMangaCustomRequest>;
