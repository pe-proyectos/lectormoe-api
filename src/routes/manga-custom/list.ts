import { Elysia, t } from 'elysia';

import { listMangaCustom } from '../../controllers/manga-custom/list';
import { useOrganization } from '../../plugins/organization';

export const router = () => new Elysia()
    .use(useOrganization())
    .get(
        '/api/manga-custom',
        async ({ organizationId }) => {
            const data = await listMangaCustom(organizationId);
            return { status: true, data };
        },
        {
            response: t.Object({
                status: t.Boolean(),
                data: t.Array(t.Any()),
            }),
        }
    );
