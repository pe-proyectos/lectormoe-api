import { Elysia, t } from 'elysia';

import { loggedUserOnly } from '../../plugins/auth';
import { restoreMangaCustom } from '../../controllers/manga-custom/restore';

export const router = () => new Elysia()
    .use(loggedUserOnly())
    .post(
        '/api/manga-custom/:mangaSlug/restore',
        async ({ organizationId, user, params: { mangaSlug } }) => {
            const permissions = user.permissions.find((p: any) => p.organizationId === organizationId);
            if (!permissions?.canDeleteMangaCustom) {
                throw new Error("No tiene permisos para restaurar mangas custom.");
            }

            await restoreMangaCustom(organizationId, mangaSlug);

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
