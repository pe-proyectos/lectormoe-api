import { type Static, t } from 'elysia';

export const CreateCommentRequest = t.Object({
    identifier: t.String(),
    comment: t.String(),
    parentId: t.Optional(t.Number()),
    imageUrl: t.Optional(t.String()),
});

export type CreateCommentRequest = Static<typeof CreateCommentRequest>;
