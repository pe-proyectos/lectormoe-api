import { Elysia, t } from 'elysia';

import { unreadUserChapterHistoryChapter } from '../../controllers/user-chapter-history/unread-chapter';
import { loggedOptional } from '../../plugins/auth';

export const router = () => new Elysia()
    .use(loggedOptional())
    .delete(
        '/api/user-chapter-history/manga-custom/:mangaSlug/chapter/:chapterNumber',
        async ({ logged, user, organizationId, params: { mangaSlug, chapterNumber } }) => {
            if (!logged || !user) {
                throw new Error('No autorizado');
            }
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
