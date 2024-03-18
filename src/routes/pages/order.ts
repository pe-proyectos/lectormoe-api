import { Elysia, t } from 'elysia';

import { loggedMemberOnly } from '../../plugins/auth';
import { listPages } from '../../controllers/pages/list';
import { OrderPagesRequest } from '../../types/pages/order';
import { orderPages } from '../../controllers/pages/order';

export const router = () => new Elysia()
    .use(loggedMemberOnly())
    .post(
        '/api/manga-custom/:mangaSlug/chapter/:chapterNumber/pages/order',
        async ({ organizationId, member, body, params: { mangaSlug, chapterNumber } }) => {
            if (!member.canEditPage) {
                throw new Error("No tiene permisos para ordenar páginas.");
            }

            await orderPages(organizationId, mangaSlug, chapterNumber, body);

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
            body: OrderPagesRequest,
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
            transform({ params }) {
                params.chapterNumber = parseFloat(params.chapterNumber.toString());
            },
        }
    );
