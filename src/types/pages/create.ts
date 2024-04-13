import { type Static, t } from 'elysia';

export const CreatePagesRequest = t.Object({
    images: t.Files({
        maxSize: '25m',
    }),
});

export type CreatePagesRequest = Static<typeof CreatePagesRequest>;
