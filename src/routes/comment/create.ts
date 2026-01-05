import { Elysia, t } from 'elysia';

import { CreateCommentRequest } from '../../types/comment/create';
import { createComment } from '../../controllers/comment/create';
import { loggedOptional } from '../../plugins/auth';
import { useOrganizationOptional } from '../../plugins/organization';

export const router = () => new Elysia()
    .use(useOrganizationOptional())
    .use(loggedOptional())
    .post(
        '/api/comment',
        async ({ logged, user, organizationId, body }) => {
            if (!logged || !user) {
                throw new Error('No autorizado');
            }
            if (!organizationId) {
                throw new Error('Se requiere una organización para crear comentarios');
            }
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
