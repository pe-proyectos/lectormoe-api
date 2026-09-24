import { Elysia, t } from 'elysia';

import { getMangaCustomBySlug } from '../../controllers/manga-custom/get';
import { useOrganization } from '../../plugins/organization';
import { loggedOptional } from '../../plugins/auth';

export const router = () => new Elysia()
    .use(useOrganization())
    .use(loggedOptional())
    .get(
        '/api/manga-custom/:mangaSlug',
        async ({ organizationId, user, params: { mangaSlug }, query }) => {
            // ?includeScheduled=1 lo manda el admin: con permisos de staff se
            // incluyen los capitulos programados (publishAt). La pagina publica
            // nunca los recibe, ni siquiera para el staff.
            const includeScheduled = (query as any)?.includeScheduled === '1';
            const manga = await getMangaCustomBySlug(organizationId, mangaSlug, user, { includeScheduled });

            if (!manga) {
                throw new Error("Manga no encontrado.");
            }

            return {
                status: true,
                data: manga,
            };
        },
        {
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
        }
    );
