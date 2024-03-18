import { Elysia, t } from 'elysia';

import { loggedMemberOnly } from '../../plugins/auth';
import { listPages } from '../../controllers/pages/list';
import { deletePage } from '../../controllers/pages/delete';

export const router = () => new Elysia()
    .use(loggedMemberOnly())
    .delete(
        '/api/manga-custom/:mangaSlug/chapter/:chapterNumber/pages/:pageId',
        async ({ organizationId, member, params: { mangaSlug, chapterNumber, pageId } }) => {
            if (!member.canDeletePage) {
                throw new Error("No tiene permisos para eliminar páginas.");
            }

            await deletePage(organizationId, mangaSlug, chapterNumber, pageId);

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
