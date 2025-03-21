import { type Static, t } from 'elysia';

export const CreateCommentRequest = t.Object({
    // mangaCustomId: t.Number(),
    // chapterId: t.Number(),
    // pageNumber: t.Number(),
    // parentId: t.Optional(t.Number()),
    identifier: t.String(),
    comment: t.String()
});

export type CreateCommentRequest = Static<typeof CreateCommentRequest>;
