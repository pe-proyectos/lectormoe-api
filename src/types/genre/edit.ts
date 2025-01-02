import { Static, t } from 'elysia';

export const EditGenreRequest = t.Object({
    name: t.String(),
    description: t.Optional(t.String()),
});

export type EditGenreRequest = Static<typeof EditGenreRequest>;
