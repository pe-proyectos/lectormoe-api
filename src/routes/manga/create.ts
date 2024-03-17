import { Elysia, t } from 'elysia';

import { CreateMangaRequest } from '../../types/manga/create';
import { createManga } from '../../controllers/manga/create';

export const router = () => new Elysia()
    .post(
        '/api/manga',
        async ({ body }) => {
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
