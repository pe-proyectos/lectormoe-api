import { Elysia, t } from 'elysia';

import { getMangaCustomBySlug } from '../../controllers/manga-custom/get';
import { useOrganization } from '../../plugins/organization';
import { loggedOptional } from '../../plugins/auth';

export const router = () => new Elysia()
    .use(useOrganization())
    .use(loggedOptional())
    .get(
        '/api/manga-custom/:mangaSlug',
        async ({ organizationId, user, params: { mangaSlug } }) => {
            const manga = await getMangaCustomBySlug(organizationId, mangaSlug, user);

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
