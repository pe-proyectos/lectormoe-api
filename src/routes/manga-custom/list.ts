import { Elysia, t } from 'elysia';

import { listMangaCustom } from '../../controllers/manga-custom/list';
import { useOrganization } from '../../plugins/organization';
import { MangaCustomListQuery } from '../../types/manga-custom/list';

export const router = () => new Elysia()
    .use(useOrganization())
    .get(
        '/api/manga-custom',
        async ({ organizationId, query }) => {
            const data = await listMangaCustom(organizationId, query);
            
            return { status: true, data };
        },
        {
            query: MangaCustomListQuery,
            response: t.Object({
                status: t.Boolean(),
                data: t.Array(t.Any()),
            }),
        }
    );
