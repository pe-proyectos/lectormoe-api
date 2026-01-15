import { type Static, t } from 'elysia';

export const EditChapterRequest = t.Object({
    title: t.Optional(t.String()),
    number: t.Optional(t.Number()),
    releasedAt: t.Optional(t.Date()),
    image: t.Optional(t.Union([t.String(), t.Null()])),
    pages: t.Optional(t.Array(t.String())),
    singlePages: t.Optional(t.Union([
        t.Array(t.Number()),
        t.String(),
    ])),
});

export type EditChapterRequest = Static<typeof EditChapterRequest>;
