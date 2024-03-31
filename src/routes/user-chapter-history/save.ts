import { Elysia, t } from 'elysia';

import { saveUserChapterHistory } from '../../controllers/user-chapter-history/save';
import { loggedUserOnly } from '../../plugins/auth';

export const router = () => new Elysia()
    .use(loggedUserOnly())
    .get(
        '/api/user-chapter-history/manga-custom/:mangaSlug/chapter/:chapterNumber/pages/:pageNumber',
        async ({ organizationId, user, params: { mangaSlug, chapterNumber, pageNumber } }) => {
            const view = await saveUserChapterHistory(organizationId, user.id, mangaSlug, chapterNumber, pageNumber);

            if (!view) {
                throw new Error("No se pudo guardar el historial.");
            }

            return {
                status: true,
                data: true,
            };
        },
        {
            params: t.Object({
                mangaSlug: t.String(),
                chapterNumber: t.Number(),
                pageNumber: t.Number(),
            }),
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
            transform({ params }) {
                params.chapterNumber = parseFloat(params.chapterNumber.toString());
                params.pageNumber = parseFloat(params.pageNumber.toString());
            },
        }
    );
