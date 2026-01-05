import { Static, t } from 'elysia';

export const CreateAuthorRequest = t.Object({
    name: t.String(),
    shortDescription: t.Optional(t.String()),
    description: t.Optional(t.String()),
    image: t.Optional(t.Union([t.String(), t.Null()])),
});

export type CreateAuthorRequest = Static<typeof CreateAuthorRequest>;
