import { Elysia, t } from 'elysia';

import { createPages } from '../../controllers/pages/create';
import { loggedMemberOnly } from '../../plugins/auth';
import { CreatePagesRequest } from '../../types/pages/create';
import { listPages } from '../../controllers/pages/list';

export const router = () => new Elysia()
    .use(loggedMemberOnly())
    .post(
        '/api/manga-custom/:mangaSlug/chapter/:chapterNumber/pages',
        async ({ organizationId, member, body, params: { mangaSlug, chapterNumber } }) => {
            if (!member.canCreatePage) {
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
            transform({ params }) {
                params.chapterNumber = parseFloat(params.chapterNumber.toString());
            },
        }
    );
