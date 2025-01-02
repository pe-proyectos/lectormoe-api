import { Elysia, t } from 'elysia';

import { getChapter } from '../../controllers/chapter/get';
import { useOrganization } from '../../plugins/organization';
import { loggedOptional } from '../../plugins/auth';
import { getMangaCustomBySlug } from '../../controllers/manga-custom/get';

export const router = () => new Elysia()
    .use(useOrganization())
    .use(loggedOptional())
    .get(
        '/api/manga-custom/:mangaSlug/chapter/:chapterNumber',
        async ({ organizationId, params: { mangaSlug, chapterNumber } }) => {
            const chapter = await getChapter(organizationId, mangaSlug, chapterNumber);

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
                mangaSlug: t.String(),
                chapterNumber: t.Number(),
            }),
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
            transform({ params }) {
                params.chapterNumber = Number.parseFloat(params.chapterNumber.toString());
            },
        }
    );
