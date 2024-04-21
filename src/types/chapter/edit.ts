import { type Static, t } from 'elysia';

export const EditChapterRequest = t.Object({
    title: t.Optional(t.String()),
    number: t.Optional(t.Number()),
    releasedAt: t.Date(),
    isSubscription: t.Boolean(),
    image: t.Optional(
        t.Union([
            t.File({
                maxSize: '25m',
            }),
            t.String(),
        ])
    ),
    pages: t.Optional(
        t.Array(
            t.Union([
                t.File({
                    maxSize: '25m',
                }),
                t.String(),
            ])
        )
    ),
});

export type EditChapterRequest = Static<typeof EditChapterRequest>;
