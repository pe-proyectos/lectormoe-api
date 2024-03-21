import { Elysia, t } from 'elysia';

import { editMangaCustom } from '../../controllers/manga-custom/edit';
import { loggedMemberOnly } from '../../plugins/auth';
import { EditMangaCustomRequest } from '../../types/manga-custom/edit';

export const router = () => new Elysia()
    .use(loggedMemberOnly())
    .patch(
        '/api/manga-custom/:mangaSlug',
        async ({ organizationId, member, body, params: { mangaSlug } }) => {
            if (!member.canEditMangaCustom) {
                throw new Error("No tiene permisos para editar mangas custom.");
            }

            const manga = await editMangaCustom(organizationId, mangaSlug, body);

            if (!manga) {
                throw new Error("No se pudo editar el manga custom.");
            }

            return {
                status: true,
                data: manga,
            };
        },
        {
            body: EditMangaCustomRequest,
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
            transform({ body }) {
                body.mangaCustomId = parseInt(body.mangaCustomId.toString());
                if (body.nextChapterAt) {
                    body.nextChapterAt = new Date(body.nextChapterAt);
                }
                if (body.releasedAt) {
                    body.releasedAt = new Date(body.releasedAt);
                }
            },
        }
    );
