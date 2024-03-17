import { Elysia, t } from 'elysia';

import { EditChapterRequest } from '../../types/chapter/edit';
import { editChapter } from '../../controllers/chapter/edit';
import { authMiddleware } from '../../plugins/auth';

export const router = () => new Elysia()
    .use(authMiddleware({ loggedOnly: true }))
    .patch(
        '/api/organization/:organizationSlug/manga-custom/:mangaSlug/chapter/:chapterNumber',
        async ({ user, body, params: { organizationSlug, mangaSlug, chapterNumber } }) => {
            const manga = await editChapter(user?.id!, organizationSlug, mangaSlug, chapterNumber, body);

            if (!manga) {
                throw new Error("No se pudo crear el manga.");
            }

            return {
                status: true,
                data: manga,
            };
        },
        {
            params: t.Object({
                organizationSlug: t.String(),
                mangaSlug: t.String(),
                chapterNumber: t.Number(),
            }),
            body: EditChapterRequest,
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
            transform({ body, params }) {
                if (body.number) body.number = parseFloat(body.number.toString());
                params.chapterNumber = parseFloat(params.chapterNumber.toString());
            },
        }
    );
