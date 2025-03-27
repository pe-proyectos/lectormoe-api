import { Elysia, t } from 'elysia';

import { EditCommentRequest } from '../../types/comment/edit';
import { editComment } from '../../controllers/comment/edit';
import { loggedUserOnly } from '../../plugins/auth';
import { getComment } from '../../controllers/comment/get';

export const router = () => new Elysia()
    .use(loggedUserOnly())
    .put(
        '/api/comment/:id',
        async ({ params, organizationId, user, body }) => {
            const comment = await getComment(Number(params.id));
            if (!comment) {
                throw new Error("Comentario no encontrado.");
            }
            if (comment.organizationId !== organizationId) {
                throw new Error("No tiene permisos para eliminar este comentario.");
            }
            const isMyComment = comment.userId === user.id;
            const canEditComments = user.canEditComment || isMyComment;

            if (!canEditComments) {
                throw new Error("No tiene permisos para editar este comentario.");
            }

            const commentEdited = await editComment(parseInt(params.id), body);

            if (!commentEdited) {
                throw new Error("No se pudo editar el comentario.");
            }

            return {
                status: true,
                data: commentEdited,
            };
        },
        {
            params: t.Object({
                id: t.String(),
            }),
            body: EditCommentRequest,
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
        }
    );
