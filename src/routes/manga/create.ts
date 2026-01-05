import { Elysia, t } from 'elysia';

import { CreateMangaRequest } from '../../types/manga/create';
import { createManga } from '../../controllers/manga/create';
import { loggedUserOnly } from '../../plugins/auth';

export const router = () => new Elysia()
    .use(loggedUserOnly())
    .post(
        '/api/manga',
        async ({ permissions, body }) => {
            if (!permissions?.canCreateMangaProfile) {
                throw new Error("No tiene permisos para crear mangas.");
            }

            const manga = await createManga(body);

            if (!manga) {
                throw new Error("No se pudo crear el manga.");
            }

            return {
                status: true,
                data: manga,
            };
        },
        {
            body: CreateMangaRequest,
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
        }
    );
