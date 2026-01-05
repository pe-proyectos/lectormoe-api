import { Elysia, t } from 'elysia';

import { deleteFavorite } from '../../controllers/favorites/delete';
import { loggedOptional } from '../../plugins/auth';

export const router = () => new Elysia()
    .use(loggedOptional())
    .delete(
        '/api/favorites/manga-custom/:mangaSlug',
        async ({ logged, user, organizationId, params: { mangaSlug } }) => {
            if (!logged || !user) {
                throw new Error('No autorizado');
            }
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
