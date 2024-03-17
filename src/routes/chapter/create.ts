import { Elysia, t } from 'elysia';

import { CreateChapterRequest } from '../../types/chapter/create';
import { createChapter } from '../../controllers/chapter/create';
import { authMiddleware } from '../../plugins/auth';

export const router = () => new Elysia()
    .use(authMiddleware({ loggedOnly: true }))
    .post(
        '/api/organization/:organizationSlug/manga-custom/:mangaSlug/chapter',
        async ({ user, body, params: { organizationSlug, mangaSlug } }) => {
            const manga = await createChapter(user?.id!, organizationSlug, mangaSlug, body);

            if (!manga) {
                throw new Error("No se pudo crear el manga.");
            }

            return {
                status: true,
                data: manga,
            };
        },
        {
            body: CreateChapterRequest,
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
            transform({ body }) {
                body.number = parseFloat(body.number.toString());
            },
        }
    );
