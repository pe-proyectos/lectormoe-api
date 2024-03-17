import { Static, t } from 'elysia';

export const CreateMangaRequest = t.Object({
    title: t.String(),
    authorIds: t.Array(t.Number()),
    demographyId: t.Number(),
    shortDescription: t.String(),
    description: t.String(),
});

export type CreateMangaRequest = Static<typeof CreateMangaRequest>;
