import { Elysia, t } from 'elysia';

import { listMangaCustom } from '../../controllers/manga-custom/list';
import { useOrganization } from '../../plugins/organization';
import { MangaCustomListQuery } from '../../types/manga-custom/list';

export const router = () => new Elysia()
    .use(useOrganization())
    .get(
        '/api/manga-custom',
        async ({ organizationId, query }) => {
            const { data, maxPage, total } = await listMangaCustom(organizationId, query);
            
            return { status: true, data: {
                data,
                maxPage,
                total,
            } };
        },
        {
            query: MangaCustomListQuery,
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
        }
    );
