import { Elysia, t } from 'elysia';

import { listPages } from '../../controllers/pages/list';
import { useOrganization } from '../../plugins/organization';
import { getChapter } from '../../controllers/chapter/get';
import { loggedOptional } from '../../plugins/auth';

export const router = () => new Elysia()
    .use(useOrganization())
    .use(loggedOptional())
    .get(
        '/api/manga-custom/:mangaSlug/chapter/:chapterNumber/pages',
        async ({ organizationId, user, params: { mangaSlug, chapterNumber } }) => {
            const chapter = await getChapter(organizationId, mangaSlug, chapterNumber);

            if (!chapter) {
                throw new Error("Capitulo no encontrado.");
            }
            
            const isReady = new Date(chapter.releasedAt).getTime() < new Date().getTime();
            
            if (!isReady) {
                if (!user || user.members.length == 0 || !user.members.some(member => member.canCreateChapter)) { // todo: change this to canReadUnreleasedChapter
                    throw new Error("No tiene permisos para leer capítulos sin publicar.");
                }
            }

            const pages = await listPages(organizationId, mangaSlug, chapterNumber);

            return {
                status: true,
                data: pages
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
                params.chapterNumber = parseFloat(params.chapterNumber.toString());
            },
        }
    );
