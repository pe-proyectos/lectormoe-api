import { Elysia, t } from 'elysia';

import { listPages } from '../../controllers/pages/list';
import { useOrganization } from '../../plugins/organization';

export const router = () => new Elysia()
    .use(useOrganization())
    .get(
        '/api/manga-custom/:mangaSlug/chapter/:chapterNumber/pages',
        async ({ organizationId, params: { mangaSlug, chapterNumber } }) => {
            const pages = await listPages(organizationId, mangaSlug, chapterNumber);

            return {
                status: true,
                data: pages
            };
        },
        {
            params: t.Object({
                mangaSlug: t.String(),
                chapterNumber: t.Number(),
            }),
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
            transform({ params }) {
                params.chapterNumber = parseFloat(params.chapterNumber.toString());
            },
        }
    );
