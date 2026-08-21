import { Elysia, t } from 'elysia';

import { listMangaCustom } from '../../controllers/manga-custom/list';
import { useOrganizationOptional } from '../../plugins/organization';
import { loggedOptional } from '../../plugins/auth';
import { MangaCustomListQuery } from '../../types/manga-custom/list';

export const router = () => new Elysia()
    .use(useOrganizationOptional())
    .use(loggedOptional())
    .get(
        '/api/manga-custom',
        async ({ organizationId, query, user }) => {
            const { data, maxPage, total } = await listMangaCustom(organizationId, query, user);
            
            return { status: true, data: {
                items: data,
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
