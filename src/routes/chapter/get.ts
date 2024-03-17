import { Elysia, t } from 'elysia';

import { getChapter } from '../../controllers/chapter/get';

export const router = () => new Elysia()
    .get(
        '/api/organization/:organizationSlug/manga-custom/:mangaSlug/chapter/:chapterNumber',
        async ({ params: { organizationSlug, mangaSlug, chapterNumber } }) => {
            const chapter = await getChapter(organizationSlug, mangaSlug, chapterNumber);

            if (!chapter) {
                throw new Error("Capitulo no encontrado.");
            }

            return {
                status: true,
                data: chapter
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
