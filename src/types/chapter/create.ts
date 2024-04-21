import { type Static, t } from 'elysia';

export const CreateChapterRequest = t.Object({
    title: t.String(),
    releasedAt: t.Date(),
    isSubscription: t.Boolean(),
    number: t.Number(),
    image: t.Optional(
        t.Union([
            t.File({
                maxSize: '25m',
            }),
            t.String(),
        ])
    ),
    pages: t.Optional(t.Array(
        t.Union([
            t.File({
                maxSize: '25m',
            }),
            t.String(),
        ])
    )),
});

export type CreateChapterRequest = Static<typeof CreateChapterRequest>;
