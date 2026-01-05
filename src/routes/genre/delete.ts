import { Elysia, t } from 'elysia';

import { deleteGenre } from '../../controllers/genre/delete';
import { loggedUserOnly } from '../../plugins/auth';

export const router = () => new Elysia()
    .use(loggedUserOnly())
    .delete(
        '/api/genre/:genreSlug',
        async ({ organizationId, permissions, params: { genreSlug } }) => {
            if (!permissions?.canDeleteGenre) {
                throw new Error("No tiene permisos para eliminar géneros.");
            }

            const genre = await deleteGenre(organizationId, genreSlug);

            if (!genre) {
                throw new Error("No se pudo eliminar el género.");
            }

            return {
                status: true,
                message: "Género eliminado con éxito.",
            };
        },
        {
            params: t.Object({
                genreSlug: t.String(),
            }),
            response: t.Object({
                status: t.Boolean(),
                message: t.String(),
            }),
        }
    );
