import { Static, t } from 'elysia';

export const CreatePagesRequest = t.Object({
    images: t.Files(),
});

export type CreatePagesRequest = Static<typeof CreatePagesRequest>;
