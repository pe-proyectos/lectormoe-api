import { Elysia, t } from 'elysia';
import { loggedOptional } from '../../plugins/auth';
import { useOrganizationOptional } from '../../plugins/organization';
import { deleteComment } from '../../controllers/comment/delete';
import { getComment } from '../../controllers/comment/get';

export const router = () => new Elysia()
    .use(useOrganizationOptional())
    .use(loggedOptional())
    .delete(
        '/api/comment/:id',
        async ({ logged, user, organizationId, params }) => {
            if (!logged || !user) {
                throw new Error('No autorizado');
            }
            if (!organizationId) {
                throw new Error('Se requiere una organización');
            }
            const permissions = user.permissions.find((p: any) => p.organizationId === organizationId);
            const comment = await getComment(Number(params.id));
            if (!comment) {
                throw new Error("Comentario no encontrado.");
            }
            if (comment.organizationId !== organizationId) {
                throw new Error("No tiene permisos para eliminar este comentario.");
            }
            // El autor del comentario o staff con canDeleteComment pueden eliminarlo
            const isMyComment = comment.userId === user.id;
            const canDeleteComments = permissions?.canDeleteComment || isMyComment;
            if (!canDeleteComments) {
                throw new Error("No tiene permisos para eliminar este comentario.");
            }

            const commentDeleted = await deleteComment(Number(params.id));

            return {
                status: true,
                data: commentDeleted
            };
        },
        {
            params: t.Object({
                id: t.String()
            }),
            response: t.Object({
                status: t.Boolean(),
                data: t.Any()
            })
        }
    );
