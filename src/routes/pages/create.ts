import { Elysia, t } from 'elysia';

import { createPages } from '../../controllers/pages/create';
import { loggedUserOnly } from '../../plugins/auth';
import { CreatePagesRequest } from '../../types/pages/create';
import { listPages } from '../../controllers/pages/list';

export const router = () => new Elysia()
    .use(loggedUserOnly())
    .post(
        '/api/manga-custom/:mangaSlug/chapter/:chapterNumber/pages',
        async ({ organizationId, user, body, params: { mangaSlug, chapterNumber } }) => {
            if (!user.canCreatePage) {
                throw new Error("No tiene permisos para crear páginas.");
            }

            const pages = await createPages(organizationId, mangaSlug, chapterNumber, body);

            if (pages.length === 0) {
                throw new Error("No se creó ninguna página.");
            }

            const allPages = await listPages(organizationId, mangaSlug, chapterNumber);

            return {
                status: true,
                data: allPages,
            };
        },
        {
            params: t.Object({
                mangaSlug: t.String(),
                chapterNumber: t.Number(),
            }),
            body: CreatePagesRequest,
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
            transform({ params, body }) {
                params.chapterNumber = parseFloat(params.chapterNumber.toString());
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
