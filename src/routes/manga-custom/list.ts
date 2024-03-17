import { Elysia, t } from 'elysia';

import { listMangaCustom } from '../../controllers/manga-custom/list';
import { authMiddleware } from '../../plugins/auth';

export const router = () => new Elysia()
    .use(authMiddleware({ loggedOnly: false }))
    .get(
        '/api/organization/:organizationSlug/manga-custom',
        async ({ params: { organizationSlug }}) => {
            const data = await listMangaCustom(organizationSlug);
            return { status: true, data };
        },
        {
            response: t.Object({
                status: t.Boolean(),
                data: t.Array(t.Any()),
            }),
        }
    );
