import { Elysia, t } from 'elysia';

import { EditChapterRequest } from '../../types/chapter/edit';
import { editChapter } from '../../controllers/chapter/edit';
import { loggedMemberOnly } from '../../plugins/auth';

export const router = () => new Elysia()
    .use(loggedMemberOnly())
    .patch(
        '/api/manga-custom/:mangaSlug/chapter/:chapterNumber',
        async ({ organizationId, member, body, params: { mangaSlug, chapterNumber } }) => {
            if (!member.canEditChapter) {
                throw new Error("No tiene permisos para editar capítulos.");
            }

            const manga = await editChapter(organizationId, mangaSlug, chapterNumber, body);

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
