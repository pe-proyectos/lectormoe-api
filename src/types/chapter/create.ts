import { Static, t } from 'elysia';

export const CreateChapterRequest = t.Object({
    title: t.String(),
    number: t.Number(),
    image: t.Optional(t.File()),
    pages: t.Optional(t.Array(t.File())),
});

export type CreateChapterRequest = Static<typeof CreateChapterRequest>;
