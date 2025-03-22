import { Elysia, t } from 'elysia';

import { CreateCommentRequest } from '../../types/comment/create';
import { createComment } from '../../controllers/comment/create';
import { loggedUserOnly } from '../../plugins/auth';

export const router = () => new Elysia()
    .use(loggedUserOnly())
    .post(
        '/api/comment',
        async ({ organizationId, user, body }) => {
            const commentCreated = await createComment(organizationId, user.id, body);

            if (!commentCreated) {
                throw new Error("No se pudo crear el comentario.");
            }

            return {
                status: true,
                data: commentCreated,
            };
        },
        {
            body: CreateCommentRequest,
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
        }
    );
