import { Elysia, t } from 'elysia';

import { createPages } from '../../controllers/pages/create';
import { authMiddleware } from '../../plugins/auth';
import { CreatePagesRequest } from '../../types/pages/create';
import { listPages } from '../../controllers/pages/list';

export const router = () => new Elysia()
    .use(authMiddleware({ loggedOnly: true }))
    .post(
        '/api/organization/:organizationSlug/manga-custom/:mangaSlug/chapter/:chapterNumber/pages',
        async ({ user, body, params: { organizationSlug, mangaSlug, chapterNumber } }) => {
            const pages = await createPages(user?.id!, organizationSlug, mangaSlug, chapterNumber, body);

            if (pages.length === 0) {
                throw new Error("No se creó ninguna página.");
            }

            const allPages = await listPages(organizationSlug, mangaSlug, chapterNumber);

            return {
                status: true,
                data: allPages,
            };
        },
        {
            params: t.Object({
                organizationSlug: t.String(),
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
