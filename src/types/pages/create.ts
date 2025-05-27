import { type Static, t } from 'elysia';

export const CreatePagesRequest = t.Object({
    images: t.Files({
        maxSize: '25m',
    }),
    singlePages: t.Optional(t.Union([
        t.Array(t.Number()),
        t.String(),
    ])),
});

export type CreatePagesRequest = Static<typeof CreatePagesRequest>;
