import { Elysia, t } from 'elysia';

import { loggedMemberOnly } from '../../plugins/auth';
import { deleteMangaCustom } from '../../controllers/manga-custom/delete';

export const router = () => new Elysia()
    .use(loggedMemberOnly())
    .delete(
        '/api/manga-custom/:mangaSlug',
        async ({ organizationId, member, params: { mangaSlug } }) => {
            throw new Error('TBA');

            if (!member.canDeleteMangaCustom) {
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
