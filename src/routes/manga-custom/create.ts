import { Elysia, t } from 'elysia';

import { CreateMangaCustomRequest } from '../../types/manga-custom/create';
import { createMangaCustom } from '../../controllers/manga-custom/create';

export const router = () => new Elysia()
    .post(
        '/api/organization/:organizationSlug/manga-custom',
        async ({ body, params: { organizationSlug } }) => {
            const manga = await createMangaCustom(organizationSlug, body);

            if (!manga) {
                throw new Error("No se pudo crear el manga custom.");
            }

            return {
                status: true,
                data: manga,
            };
        },
        {
            body: CreateMangaCustomRequest,
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
            transform({ body }) {
                body.mangaId = parseInt(body.mangaId.toString());
                if (body.nextChapterAt) {
                    body.nextChapterAt = new Date(body.nextChapterAt);
                }
                if (body.releasedAt) {
                    body.releasedAt = new Date(body.releasedAt);
                }
            },
        }
    );
