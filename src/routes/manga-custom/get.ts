import { Elysia, t } from 'elysia';

import { getMangaCustomBySlug } from '../../controllers/manga-custom/get';

export const router = () => new Elysia()
    .get(
        '/api/organization/:organizationSlug/manga-custom/:mangaSlug',
        async ({ params: { organizationSlug, mangaSlug } }) => {
            const manga = await getMangaCustomBySlug(organizationSlug, mangaSlug);

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
