import { Elysia, t } from 'elysia';

import { authMiddleware } from '../../plugins/auth';
import { listPages } from '../../controllers/pages/list';
import { deletePage } from '../../controllers/pages/delete';

export const router = () => new Elysia()
    .use(authMiddleware({ loggedOnly: true }))
    .delete(
        '/api/organization/:organizationSlug/manga-custom/:mangaSlug/chapter/:chapterNumber/pages/:pageId',
        async ({ user, params: { organizationSlug, mangaSlug, chapterNumber, pageId } }) => {
            await deletePage(user?.id!, organizationSlug, mangaSlug, chapterNumber, pageId);

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
                pageId: t.Number(),
            }),
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
            transform({ params }) {
                params.chapterNumber = parseFloat(params.chapterNumber.toString());
                params.pageId = parseFloat(params.pageId.toString());
            },
        }
    );
