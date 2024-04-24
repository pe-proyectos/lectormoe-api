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
                if (body.number) body.number = Number.parseFloat(body.number.toString());
                params.chapterNumber = Number.parseFloat(params.chapterNumber.toString());
                if (body.releasedAt !== undefined) body.releasedAt = body.releasedAt && new Date(body.releasedAt);
                if (body.isSubscription !== undefined) body.isSubscription = body?.isSubscription?.toString() === 'true';
                if (body.pages instanceof File || typeof body.pages === 'string')
                    body.pages = [body.pages];
            },
        }
    );
