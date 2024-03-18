import { Elysia, t } from 'elysia';

import { getMangaCustomBySlug } from '../../controllers/manga-custom/get';
import { useOrganization } from '../../plugins/organization';

export const router = () => new Elysia()
    .use(useOrganization())
    .get(
        '/api/manga-custom/:mangaSlug',
        async ({ organizationId, params: { mangaSlug } }) => {
            const manga = await getMangaCustomBySlug(organizationId, mangaSlug);

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
