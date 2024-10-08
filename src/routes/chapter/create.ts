import { Elysia, t } from 'elysia';

import { CreateChapterRequest } from '../../types/chapter/create';
import { createChapter } from '../../controllers/chapter/create';
import { loggedMemberOnly } from '../../plugins/auth';

export const router = () => new Elysia()
    .use(loggedMemberOnly())
    .post(
        '/api/manga-custom/:mangaSlug/chapter',
        async ({ organizationId, member, body, params: { mangaSlug } }) => {
            if (!member.canCreateChapter) {
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
                body.isSubscription = body?.isSubscription?.toString() === 'true';
                if (body.pages instanceof File || typeof body.pages === 'string')
                    body.pages = [body.pages];
            },
        }
    );
