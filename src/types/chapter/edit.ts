import { Static, t } from 'elysia';

export const EditChapterRequest = t.Object({
    title: t.Optional(t.String()),
    number: t.Optional(t.Number()),
    image: t.Optional(t.File()),
});

export type EditChapterRequest = Static<typeof EditChapterRequest>;
