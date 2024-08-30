import { type Static, t } from 'elysia';

export const EditMangaCustomRequest = t.Object({
    mangaCustomId: t.Number(),
    status: t.Optional(t.String()),
    title: t.Optional(t.String()),
    shortDescription: t.Optional(t.String()),
    description: t.Optional(t.String()),
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
    releasedAt: t.Optional(t.Date()),
    nextChapterAt: t.Optional(t.Date()),
});

export type EditMangaCustomRequest = Static<typeof EditMangaCustomRequest>;
