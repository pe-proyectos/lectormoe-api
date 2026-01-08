import { Elysia, t } from 'elysia';

import { EditGenreRequest } from '../../types/genre/edit';
import { editGenre } from '../../controllers/genre/edit';
import { loggedUserOnly } from '../../plugins/auth';

export const router = () => new Elysia()
    .use(loggedUserOnly())
    .patch(
        '/api/genre/:genreSlug',
        async ({ organizationId, user, params, body }) => {
            const permissions = user.permissions.find((p: any) => p.organizationId === organizationId);
            if (!permissions?.canEditGenre) {
                throw new Error("No tiene permisos para editar géneros.");
            }

            const genre = await editGenre(organizationId, params.genreSlug, body);

            if (!genre) {
                throw new Error("No se pudo editar el género.");
            }

            return {
                status: true,
                data: genre,
            };
        },
        {
            params: t.Object({
                genreSlug: t.String(),
            }),
            body: EditGenreRequest,
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
        }
    );
