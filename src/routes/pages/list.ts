import { Elysia, t } from 'elysia';

import { listPages } from '../../controllers/pages/list';

export const router = () => new Elysia()
    .get(
        '/api/organization/:organizationSlug/manga-custom/:mangaSlug/chapter/:chapterNumber/pages',
        async ({ params: { organizationSlug, mangaSlug, chapterNumber } }) => {
            const pages = await listPages(organizationSlug, mangaSlug, chapterNumber);

            return {
                status: true,
                data: pages
            };
        },
        {
            params: t.Object({
                organizationSlug: t.String(),
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
