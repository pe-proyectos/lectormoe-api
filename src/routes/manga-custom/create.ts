import { Elysia, t } from 'elysia';

import { CreateMangaCustomRequest } from '../../types/manga-custom/create';
import { createMangaCustom } from '../../controllers/manga-custom/create';
import { loggedUserOnly } from '../../plugins/auth';

export const router = () => new Elysia()
    .use(loggedUserOnly())
    .post(
        '/api/manga-custom',
        async ({ organizationId, user, body }) => {
            if (!user.canCreateMangaCustom) {
                throw new Error("No tiene permisos para crear mangas custom.");
            }

            const manga = await createMangaCustom(organizationId, body);

            if (!manga) {
                throw new Error("No se pudo crear el manga custom.");
            }

            return {
                status: true,
                data: manga,
            };
        },
        {
            body: CreateMangaCustomRequest,
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
            transform({ body }) {
                body.mangaId = Number.parseInt(body.mangaId.toString());
                if (body.nextChapterAt) {
                    body.nextChapterAt = new Date(body.nextChapterAt);
                }
                if (body.releasedAt) {
                    body.releasedAt = new Date(body.releasedAt);
                }
                if (body.requireLogin) {
                    body.requireLogin = body.requireLogin.toString() === "true";
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
