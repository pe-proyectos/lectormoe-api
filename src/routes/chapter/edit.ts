import { Elysia, t } from 'elysia';

import { EditChapterRequest } from '../../types/chapter/edit';
import { editChapter } from '../../controllers/chapter/edit';
import { loggedUserOnly } from '../../plugins/auth';

export const router = () => new Elysia()
    .use(loggedUserOnly())
    .patch(
        '/api/manga-custom/:mangaSlug/chapter/:chapterNumber',
        async ({ organizationId, user, body, params: { mangaSlug, chapterNumber } }) => {
            const permissions = user.permissions.find((p: any) => p.organizationId === organizationId);
            if (!permissions?.canEditChapter) {
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
                
                if (body.pages instanceof File || typeof body.pages === 'string')
                    body.pages = [body.pages];
                try {
                  // Handle singlePages: it can be an array, a string, or undefined
                  if (body.singlePages === undefined || body.singlePages === null) {
                    body.singlePages = [];
                  } else if (Array.isArray(body.singlePages)) {
                    // Already an array, just convert to numbers
                    body.singlePages = body.singlePages.map(Number) as number[];
                  } else if (typeof body.singlePages === 'string') {
                    // It's a string, try to parse it
                    body.singlePages = JSON.parse(body.singlePages).map(Number) as number[];
                  } else {
                    // Fallback: try to convert to array
                    body.singlePages = [Number(body.singlePages)];
                  }
                } catch (error) {
                  console.error(error);
                  body.singlePages = [];
                }
            },
        }
    );
