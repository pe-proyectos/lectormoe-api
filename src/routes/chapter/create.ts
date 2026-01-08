import { Elysia, t } from 'elysia';

import { CreateChapterRequest } from '../../types/chapter/create';
import { createChapter } from '../../controllers/chapter/create';
import { loggedUserOnly } from '../../plugins/auth';

export const router = () => new Elysia()
    .use(loggedUserOnly())
    .post(
        '/api/manga-custom/:mangaSlug/chapter',
        async ({ organizationId, user, body, params: { mangaSlug } }) => {
            const permissions = user.permissions.find((p: any) => p.organizationId === organizationId);
            if (!permissions?.canCreateChapter) {
                throw new Error("No tiene permisos para crear capítulos.");
            }

            const manga = await createChapter(organizationId, mangaSlug, body);

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
                body.number = Number.parseFloat(body.number.toString());

                body.releasedAt = body?.releasedAt && new Date(body.releasedAt);

                body.subscribersOnly = body?.subscribersOnly?.toString() === "true";

                if (body.pages instanceof File || typeof body.pages === 'string')
                    body.pages = [body.pages];

                try {

                  body.singlePages = (
                    body.singlePages
                      ? JSON.parse(body?.singlePages?.toString() || "[]")
                      : []
                  ).map(Number) as number[];
                  
                } catch (error) {
                  console.error(error);
                  body.singlePages = [];
                }
            },
        }
    );
