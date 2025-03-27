import { type Static, t } from 'elysia';

export const EditCommentRequest = t.Object({
    comment: t.String(),
});

export type EditCommentRequest = Static<typeof EditCommentRequest>;
