import { Elysia, t } from 'elysia';

import { loggedUserOnly } from '../../plugins/auth';
import { deleteMangaCustom } from '../../controllers/manga-custom/delete';

export const router = () => new Elysia()
    .use(loggedUserOnly())
    .delete(
        '/api/manga-custom/:mangaSlug',
        async ({ organizationId, permissions, params: { mangaSlug } }) => {
            throw new Error('TBA');

            if (!permissions?.canDeleteMangaCustom) {
                throw new Error("No tiene permisos para eliminar mangas custom.");
            }

            await deleteMangaCustom(organizationId, mangaSlug);

            return {
                status: true,
                data: true,
            };
        },
        {
            response: t.Object({
                status: t.Boolean(),
                data: t.Boolean(),
            }),
        }
    );
