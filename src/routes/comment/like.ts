import { Elysia, t } from 'elysia';
import { loggedUserOnly } from '../../plugins/auth';
import { likeComment } from '../../controllers/comment/like';
import { getComment } from '../../controllers/comment/get';

export const router = () => new Elysia()
    .use(loggedUserOnly())
    .post(
        '/api/comment/:id/like',
        async ({ organizationId, user, params, body }) => {
            const comment = await getComment(Number(params.id));
            if (!comment) {
                throw new Error("Comentario no encontrado.");
            }
            if (comment.organizationId !== organizationId) {
                throw new Error("No tiene permisos para votar este comentario.");
            }
            if (comment.userId === user.id) {
                throw new Error("No puede votar a su propio comentario.");
            }

            const commentUpdated = await likeComment(organizationId, user.id, Number(params.id), body.like);

            return {
                status: true,
                data: commentUpdated
            };
        },
        {
            params: t.Object({
                id: t.String()
            }),
            body: t.Object({
                like: t.Boolean()
            }),
            response: t.Object({
                status: t.Boolean(),
                data: t.Any()
            })
        }
    );
