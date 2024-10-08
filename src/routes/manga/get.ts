import { Elysia, t } from 'elysia';

import { getMangaBySlug } from '../../controllers/manga/get';

export const router = () => new Elysia()
    .get(
        '/api/manga/:mangaSlug',
        async ({ params: { mangaSlug } }) => {
            const manga = await getMangaBySlug(mangaSlug);

            if (!manga) {
                throw new Error("Manga no encontrado.");
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
