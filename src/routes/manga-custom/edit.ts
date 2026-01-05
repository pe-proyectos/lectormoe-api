import { Elysia, t } from 'elysia';

import { editMangaCustom } from '../../controllers/manga-custom/edit';
import { loggedUserOnly } from '../../plugins/auth';
import { EditMangaCustomRequest } from '../../types/manga-custom/edit';

export const router = () => new Elysia()
    .use(loggedUserOnly())
    .patch(
        '/api/manga-custom/:mangaSlug',
        async ({ organizationId, permissions, body, params: { mangaSlug } }) => {
            if (!permissions?.canEditMangaCustom) {
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
                if (body.requireLogin !== undefined) {
                    body.requireLogin = body.requireLogin.toString() === "true";
                }
                if (body.isSimulRelease !== undefined) {
                    body.isSimulRelease = body.isSimulRelease.toString() === "true";
                }
                if(body.isNSFW !== undefined){
                    body.isNSFW = body.isNSFW.toString() === "true";
                }
                if(body.genreIds) {
                    body.genreIds = (body.genreIds as unknown as string).split(',').map(genreId => Number.parseInt(genreId.trim()));
                }
                if (body.subscriptionPlanIds) {
                    body.subscriptionPlanIds = (body.subscriptionPlanIds as unknown as string).split(',').map(subscriptionPlanId => Number.parseInt(subscriptionPlanId.trim()));
                }
            },
        }
    );
