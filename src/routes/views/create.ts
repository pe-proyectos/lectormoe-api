import { Elysia, t } from 'elysia';

import { createViewHistoryChapter, createViewHistoryMangaCustom } from '../../controllers/views/create';
import { useOrganization } from '../../plugins/organization';
import { getIP } from '../../util/get-ip';

export const router = () => new Elysia()
    .use(useOrganization())
    .post(
        '/api/views/manga-custom/:mangaSlug',
        async ({ organizationId, request, params: { mangaSlug } }) => {
            const ip = request.headers.get('ip') || getIP(request.headers) || "0.0.0.0";

            const view = await createViewHistoryMangaCustom(organizationId, mangaSlug, ip);

            if (!view) {
                return {
                    status: false,
                    error: 'NOT_FOUND',
                    message: 'No se encontró el recurso.',
                };
            }

            return {
                status: true,
                data: true,
            };
        },
        {
            params: t.Object({
                mangaSlug: t.String(),
            }),
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
        }
    )
    .post(
        '/api/views/manga-custom/:mangaSlug/chapter/:chapterNumber',
        async ({ organizationId, request, params: { mangaSlug, chapterNumber } }) => {
            const ip = request.headers.get('ip') || getIP(request.headers) || "0.0.0.0";

            const view = await createViewHistoryChapter(organizationId, mangaSlug, chapterNumber, ip);

            if (!view) {
                return {
                    status: false,
                    error: 'NOT_FOUND',
                    message: 'No se encontró el recurso.',
                };
            }

            return {
                status: true,
                data: true,
            };
        },
        {
            params: t.Object({
                mangaSlug: t.String(),
                chapterNumber: t.Number(),
            }),
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
            transform({ params }) {
                params.chapterNumber = Number.parseFloat(params.chapterNumber.toString());
            },
        }
    );
