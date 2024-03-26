import { Static, t } from 'elysia';

export const CreateChapterRequest = t.Object({
    title: t.String(),
    number: t.Number(),
    image: t.Optional(t.File({
        maxSize: '25m',
    })),
    pages: t.Optional(t.Array(t.File({
        maxSize: '25m',
    }))),
});

export type CreateChapterRequest = Static<typeof CreateChapterRequest>;
