import { Elysia, t } from 'elysia';

import { loggedUserOnly } from '../../plugins/auth';
import { getFavorite } from '../../controllers/favorites/get';

export const router = () => new Elysia()
    .use(loggedUserOnly())
    .get(
        '/api/favorites/manga-custom/:mangaSlug',
        async ({ organizationId, user, params: { mangaSlug } }) => {
            const isFavorite = await getFavorite(organizationId, user.id, mangaSlug);
            
            return { status: true, data: isFavorite };
        },
        {
            response: t.Object({
                status: t.Boolean(),
                data: t.Boolean(),
            }),
        }
    );
