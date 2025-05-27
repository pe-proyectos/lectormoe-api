import { type Static, t } from 'elysia';

export const CreateChapterRequest = t.Object({
    title: t.String(),
    releasedAt: t.Date(),
    subscribersOnly: t.Boolean(),
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
    singlePages: t.Optional(t.Union([
        t.Array(t.Number()),
        t.String(),
    ])),
});

export type CreateChapterRequest = Static<typeof CreateChapterRequest>;
