import { Elysia, t } from 'elysia';

import { deleteChapter } from '../../controllers/chapter/delete';
import { loggedUserOnly } from '../../plugins/auth';

export const router = () => new Elysia()
    .use(loggedUserOnly())
    .delete(
        '/api/manga-custom/:mangaSlug/chapter/:chapterNumber',
        async ({ organizationId, user, params: { mangaSlug, chapterNumber } }) => {
            const permissions = user.permissions.find((p: any) => p.organizationId === organizationId);
            if (!permissions?.canDeleteChapter) {
                throw new Error("No tiene permisos para eliminar capítulos.");
            }
            const chapter = await deleteChapter(organizationId, mangaSlug, chapterNumber, user.id);

            if (!chapter) {
                throw new Error("Capitulo no encontrado.");
            }

            return {
                status: true,
                data: chapter
            };
        },
        {
            params: t.Object({
                mangaSlug: t.String(),
                chapterNumber: t.Number(),
            }),
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
            transform({ params }) {
                params.chapterNumber = parseFloat(params.chapterNumber.toString());
            },
        }
    );
