import { type Static, t } from 'elysia';

export const CreateChapterRequest = t.Object({
    title: t.String(),
    releasedAt: t.Optional(t.Union([t.Date(), t.Null()])),
    number: t.Number(),
    image: t.Optional(t.Union([t.String(), t.Null()])),
    pages: t.Optional(t.Array(t.String())),
    singlePages: t.Optional(t.Union([
        t.Array(t.Number()),
        t.String(),
    ])),
    isUnreleased: t.Optional(t.Boolean()),
});

export type CreateChapterRequest = Static<typeof CreateChapterRequest>;
