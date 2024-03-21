import { Elysia, t } from 'elysia';

import { deleteChapter } from '../../controllers/chapter/delete';
import { useOrganization } from '../../plugins/organization';

export const router = () => new Elysia()
    .use(useOrganization())
    .delete(
        '/api/manga-custom/:mangaSlug/chapter/:chapterNumber',
        async ({ organizationId, params: { mangaSlug, chapterNumber } }) => {
            const chapter = await deleteChapter(organizationId, mangaSlug, chapterNumber);

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
