import { Elysia, t } from 'elysia';

import { saveFavorite } from '../../controllers/favorites/save';
import { loggedUserOnly } from '../../plugins/auth';

export const router = () => new Elysia()
    .use(loggedUserOnly())
    .post(
        '/api/favorites/manga-custom/:mangaSlug',
        async ({ organizationId, user, params: { mangaSlug } }) => {
            const view = await saveFavorite(organizationId, user.id, mangaSlug);

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
