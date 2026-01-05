import { Elysia, t } from 'elysia';

import { loggedOptional } from '../../plugins/auth';
import { getFavorite } from '../../controllers/favorites/get';

export const router = () => new Elysia()
    .use(loggedOptional())
    .get(
        '/api/favorites/manga-custom/:mangaSlug',
        async ({ logged, user, organizationId, params: { mangaSlug } }) => {
            if (!logged || !user) {
                throw new Error('No autorizado');
            }
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
