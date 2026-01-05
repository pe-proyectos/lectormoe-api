import { Elysia, t } from 'elysia';

import { loggedUserOnly } from '../../plugins/auth';
import { getComment } from '../../controllers/comment/get';
import { restoreComment } from '../../controllers/comment/restore';

export const router = () => new Elysia()
    .use(loggedUserOnly())
    .post(
        '/api/comment/:id/restore',
        async ({ params, organizationId, user, permissions }) => {
            const comment = await getComment(Number(params.id));
            if (!comment) {
                throw new Error("Comentario no encontrado.");
            }
            if (comment.organizationId !== organizationId) {
                throw new Error("No tiene permisos para restaurar este comentario.");
            }
            if (!permissions?.canHideComment) {
                throw new Error("No tiene permisos para restaurar este comentario.");
            }

            const commentRestored = await restoreComment(parseInt(params.id));

            if (!commentRestored) {
                throw new Error("No se pudo restaurar el comentario.");
            }

            return {
                status: true,
                data: commentRestored,
            };
        },
        {
            params: t.Object({
                id: t.String(),
            }),
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
        }
    );
