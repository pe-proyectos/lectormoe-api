import { Elysia, t } from 'elysia';

import { HttpError } from 'elysia-http-error';
import { listFromChapter } from '../../controllers/page/list-from-chapter';
import { getChapterBySlug } from '../../controllers/chapter/get';

export const router = () => new Elysia()
    .get(
        '/api/manga/:manga_slug/chapter/:chapter_slug',
        async ({ params: { manga_slug, chapter_slug } }) => {
            const chapter = await getChapterBySlug(manga_slug, chapter_slug);

            const pages = await listFromChapter(manga_slug, chapter_slug);

            if (!pages) {
                throw HttpError.NotFound("Capitulo no encontrado.");
            }

            return {
                status: true,
                data: {
                    ...chapter,
                    pages,
                }
            };
        },
        {
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
        }
    );
