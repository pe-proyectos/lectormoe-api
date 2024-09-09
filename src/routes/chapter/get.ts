import { Elysia, t } from 'elysia';

import { getChapter } from '../../controllers/chapter/get';
import { useOrganization } from '../../plugins/organization';
import { loggedOptional } from '../../plugins/auth';

export const router = () => new Elysia()
    .use(useOrganization())
    .use(loggedOptional())
    .get(
        '/api/manga-custom/:mangaSlug/chapter/:chapterNumber',
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

            return {
                status: true,
                data: chapter
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
