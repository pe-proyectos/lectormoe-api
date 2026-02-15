import { Elysia, t } from 'elysia';

import { saveFavorite } from '../../controllers/favorites/save';
import { checkAndUnlockAchievements } from '../../controllers/user/achievements';
import { loggedOptional } from '../../plugins/auth';

export const router = () => new Elysia()
    .use(loggedOptional())
    .post(
        '/api/favorites/manga-custom/:mangaSlug',
        async ({ logged, user, organizationId, params: { mangaSlug } }) => {
            if (!logged || !user) {
                throw new Error('No autorizado');
            }
            const view = await saveFavorite(organizationId, user.id, mangaSlug);

            // Check achievements (fire-and-forget)
            checkAndUnlockAchievements(user.id, { action: 'favorite' }).catch(() => {});

            return {
                status: true,
                data: !!view,
            };
        },
        {
            params: t.Object({
                mangaSlug: t.String(),
            }),
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
        }
    );
