import { Elysia, t } from 'elysia';

import { loggedUserOnly } from '../../plugins/auth';
import { deleteMangaCustom } from '../../controllers/manga-custom/delete';

export const router = () => new Elysia()
    .use(loggedUserOnly())
    .delete(
        '/api/manga-custom/:mangaSlug',
        async ({ organizationId, user, params: { mangaSlug } }) => {
            throw new Error('TBA');

            const permissions = user.permissions.find((p: any) => p.organizationId === organizationId);
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
