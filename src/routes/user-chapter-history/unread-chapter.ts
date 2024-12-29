import { Elysia, t } from 'elysia';

import { unreadUserChapterHistoryChapter } from '../../controllers/user-chapter-history/unread-chapter';
import { loggedUserOnly } from '../../plugins/auth';

export const router = () => new Elysia()
    .use(loggedUserOnly())
    .delete(
        '/api/user-chapter-history/manga-custom/:mangaSlug/chapter/:chapterNumber',
        async ({ organizationId, user, params: { mangaSlug, chapterNumber } }) => {
            const view = await unreadUserChapterHistoryChapter(organizationId, user.id, mangaSlug, chapterNumber);

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
