import { Static, t } from 'elysia';

export const CreateAuthorRequest = t.Object({
    name: t.String(),
    shortDescription: t.String(),
    description: t.String(),
    image: t.File(),
});

export type CreateAuthorRequest = Static<typeof CreateAuthorRequest>;
