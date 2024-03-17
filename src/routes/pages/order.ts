import { Elysia, t } from 'elysia';

import { authMiddleware } from '../../plugins/auth';
import { listPages } from '../../controllers/pages/list';
import { OrderPagesRequest } from '../../types/pages/order';
import { orderPages } from '../../controllers/pages/order';

export const router = () => new Elysia()
    .use(authMiddleware({ loggedOnly: true }))
    .post(
        '/api/organization/:organizationSlug/manga-custom/:mangaSlug/chapter/:chapterNumber/pages/order',
        async ({ user, body, params: { organizationSlug, mangaSlug, chapterNumber } }) => {
            await orderPages(user?.id!, organizationSlug, mangaSlug, chapterNumber, body);

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
