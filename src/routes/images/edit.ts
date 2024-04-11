import { Elysia, t } from 'elysia';

import { useOrganization } from '../../plugins/organization';
import { GenerateImageFromPage } from '../../types/images/generate';
import { createImageFromPage } from '../../controllers/images/generate';

export const router = () => new Elysia()
    .use(useOrganization())
    .post(
        '/api/images/generate/manga/:mangaSlug',
        async ({ organizationId, body, params: { mangaSlug } }) => {
            const url = await createImageFromPage(organizationId, mangaSlug, body);

            if (!url) {
                throw new Error("No se pudo generar la imagen");
            }

            return {
                status: true,
                data: url,
            };
        },
        {
            body: GenerateImageFromPage,
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
        }
    );
