import { Elysia, t } from 'elysia';

import { saveUserChapterHistory } from '../../controllers/user-chapter-history/save';
import { checkAndUnlockAchievements } from '../../controllers/user/achievements';
import { loggedUserOnly } from '../../plugins/auth';

export const router = () => new Elysia()
    .use(loggedUserOnly())
    .post(
        '/api/user-chapter-history/manga-custom/:mangaSlug/chapter/:chapterNumber/pages/:pageNumber',
        async ({ organizationId, user, params: { mangaSlug, chapterNumber, pageNumber } }) => {
            const view = await saveUserChapterHistory(organizationId, user.id, mangaSlug, chapterNumber, pageNumber);

            if (!view) {
                return {
                    status: false,
                    error: 'NOT_FOUND',
                    message: 'No se encontró el recurso.',
                };
            }

            // Check achievements (fire-and-forget)
            const hour = new Date().getUTCHours();
            checkAndUnlockAchievements(user.id, { action: 'read', hour }).catch(() => {});

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
                params.chapterNumber = Number.parseFloat(params.chapterNumber.toString());
                params.pageNumber = Number.parseFloat(params.pageNumber.toString());
            },
        }
    );
