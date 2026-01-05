import { type Static, t } from 'elysia';

export const CreateCommentRequest = t.Object({
    identifier: t.String(),
    comment: t.String(),
    parentId: t.Optional(t.Numeric()),
    image: t.Optional(
        t.Union([
            t.File({
                maxSize: '25m',
            }),
            t.String(),
        ])
    ),
});

export type CreateCommentRequest = Static<typeof CreateCommentRequest>;
