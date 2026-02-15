import { Elysia, t } from 'elysia';

import { saveUserChapterHistoryChapter } from '../../controllers/user-chapter-history/save-chapter';
import { checkAndUnlockAchievements } from '../../controllers/user/achievements';
import { loggedOptional } from '../../plugins/auth';

export const router = () => new Elysia()
    .use(loggedOptional())
    .get(
        '/api/user-chapter-history/manga-custom/:mangaSlug/chapter/:chapterNumber',
        async ({ logged, user, organizationId, params: { mangaSlug, chapterNumber } }) => {
            if (!logged || !user) {
                throw new Error('No autorizado');
            }
            const view = await saveUserChapterHistoryChapter(organizationId, user.id, mangaSlug, chapterNumber);

            // Check achievements (fire-and-forget)
            if (view) {
                const hour = new Date().getUTCHours();
                checkAndUnlockAchievements(user.id, { action: 'read', hour }).catch(() => {});
            }

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
