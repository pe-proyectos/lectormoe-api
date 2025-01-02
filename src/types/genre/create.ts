import { Static, t } from 'elysia';

export const CreateGenreRequest = t.Object({
    name: t.String(),
    description: t.Optional(t.String()),
});

export type CreateGenreRequest = Static<typeof CreateGenreRequest>;
