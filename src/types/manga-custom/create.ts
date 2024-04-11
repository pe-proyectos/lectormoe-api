import { type Static, t } from 'elysia';

export const CreateMangaCustomRequest = t.Object({
    mangaId: t.Number(),
    title: t.String(),
    shortDescription: t.Optional(t.String()),
    description: t.Optional(t.String()),
    image: t.Optional(t.File({
        maxSize: '25m',
    })),
    banner: t.Optional(t.File({
        maxSize: '25m',
    })),
    releasedAt: t.Optional(t.Date()),
    nextChapterAt: t.Optional(t.Date()),
});

export type CreateMangaCustomRequest = Static<typeof CreateMangaCustomRequest>;
