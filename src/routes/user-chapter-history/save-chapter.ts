import { Elysia, t } from 'elysia';

import { saveUserChapterHistoryChapter } from '../../controllers/user-chapter-history/save-chapter';
import { loggedUserOnly } from '../../plugins/auth';

export const router = () => new Elysia()
    .use(loggedUserOnly())
    .get(
        '/api/user-chapter-history/manga-custom/:mangaSlug/chapter/:chapterNumber',
        async ({ organizationId, user, params: { mangaSlug, chapterNumber } }) => {
            const view = await saveUserChapterHistoryChapter(organizationId, user.id, mangaSlug, chapterNumber);

            return {
                status: true,
                data: !!view,
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
                params.chapterNumber = Number.parseFloat(params.chapterNumber.toString());
            },
        }
    );
