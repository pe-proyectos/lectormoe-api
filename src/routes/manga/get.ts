import { Elysia, t } from 'elysia';

import { getMangaBySlug } from '../../controllers/manga/get';
import { HttpError } from 'elysia-http-error';

export const router = () => new Elysia()
    .get(
        '/api/manga/:manga_slug',
        async ({ params: { manga_slug } }) => {
            const manga = await getMangaBySlug(manga_slug);

            if (!manga) {
                throw HttpError.NotFound("Manga no encontrado.");
            }

            return {
                status: true,
                data: manga,
            };
        },
        {
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
        }
    );
