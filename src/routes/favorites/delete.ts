import { Elysia, t } from 'elysia';

import { deleteFavorite } from '../../controllers/favorites/delete';
import { loggedUserOnly } from '../../plugins/auth';

export const router = () => new Elysia()
    .use(loggedUserOnly())
    .delete(
        '/api/favorites/manga-custom/:mangaSlug',
        async ({ organizationId, user, params: { mangaSlug } }) => {
            const view = await deleteFavorite(organizationId, user.id, mangaSlug);

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
