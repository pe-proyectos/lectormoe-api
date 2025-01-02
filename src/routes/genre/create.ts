import { Elysia, t } from 'elysia';

import { CreateGenreRequest } from '../../types/genre/create';
import { createGenre } from '../../controllers/genre/create';
import { loggedUserOnly } from '../../plugins/auth';

export const router = () => new Elysia()
    .use(loggedUserOnly())
    .post(
        '/api/genre',
        async ({ organizationId, user, body }) => {
            if (!user.canCreateGenre) {
                throw new Error("No tiene permisos para crear géneros.");
            }

            const genre = await createGenre(organizationId, body);

            if (!genre) {
                throw new Error("No se pudo crear el género.");
            }

            return {
                status: true,
                data: genre,
            };
        },
        {
            body: CreateGenreRequest,
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
        }
    );
