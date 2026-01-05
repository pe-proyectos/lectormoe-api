import { Elysia, t } from 'elysia';

import { loggedOptional } from '../../plugins/auth';
import { useOrganizationOptional } from '../../plugins/organization';
import { getComment } from '../../controllers/comment/get';
import { hideComment } from '../../controllers/comment/hide';

export const router = () => new Elysia()
    .use(useOrganizationOptional())
    .use(loggedOptional())
    .post(
        '/api/comment/:id/hide',
        async ({ logged, user, params, organizationId, permissions, body }) => {
            if (!logged || !user) {
                throw new Error('No autorizado');
            }
            if (!organizationId) {
                throw new Error('Se requiere una organización');
            }
            const comment = await getComment(Number(params.id));
            if (!comment) {
                throw new Error("Comentario no encontrado.");
            }
            if (comment.organizationId !== organizationId) {
                throw new Error("No tiene permisos para ocultar este comentario.");
            }
            if (!permissions?.canHideComment) {
                throw new Error("No tiene permisos para ocultar este comentario.");
            }

            const commentHidden = await hideComment(parseInt(params.id), body.reason, user.id);

            if (!commentHidden) {
                throw new Error("No se pudo ocultar el comentario.");
            }

            return {
                status: true,
                data: commentHidden,
            };
        },
        {
            params: t.Object({
                id: t.String(),
            }),
            body: t.Object({
                reason: t.Optional(t.String()),
            }),
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
        }
    );
