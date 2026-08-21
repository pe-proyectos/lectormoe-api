import { Elysia, t } from 'elysia';

import { editMangaCustom } from '../../controllers/manga-custom/edit';
import { loggedUserOnly } from '../../plugins/auth';
import { EditMangaCustomRequest } from '../../types/manga-custom/edit';

export const router = () => new Elysia()
    .use(loggedUserOnly())
    .patch(
        '/api/manga-custom/:mangaSlug',
        async ({ organizationId, user, body, params: { mangaSlug } }) => {
            const permissions = user.permissions.find((p: any) => p.organizationId === organizationId);
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
                if (body.nextChapterAt && body.nextChapterAt !== null) {
                    body.nextChapterAt = new Date(body.nextChapterAt);
                } else if (body.nextChapterAt === null) {
                    body.nextChapterAt = null;
                }
                if (body.releasedAt && body.releasedAt !== null) {
                    body.releasedAt = new Date(body.releasedAt);
                } else if (body.releasedAt === null) {
                    body.releasedAt = null;
                }
                if (body.requireLogin !== undefined && body.requireLogin !== null) {
                    body.requireLogin = body.requireLogin.toString() === "true";
                }
                if (body.isSimulRelease !== undefined && body.isSimulRelease !== null) {
                    body.isSimulRelease = body.isSimulRelease.toString() === "true";
                }
                if(body.isNSFW !== undefined && body.isNSFW !== null){
                    body.isNSFW = body.isNSFW.toString() === "true";
                }
                if((body as any).isPublic !== undefined && (body as any).isPublic !== null){
                    (body as any).isPublic = (body as any).isPublic.toString() === "true";
                }
                if(body.genreIds !== undefined) {
                    if (Array.isArray(body.genreIds)) {
                        body.genreIds = body.genreIds.map(genreId => Number.parseInt(genreId.toString()));
                    } else if (body.genreIds !== null) {
                        body.genreIds = (body.genreIds as unknown as string).split(',').map(genreId => Number.parseInt(genreId.trim()));
                    }
                }
                if (body.subscriptionPlanIdsCanReadUnreleased !== undefined) {
                    if (Array.isArray(body.subscriptionPlanIdsCanReadUnreleased)) {
                        body.subscriptionPlanIdsCanReadUnreleased = body.subscriptionPlanIdsCanReadUnreleased.map(subscriptionPlanId => Number.parseInt(subscriptionPlanId.toString()));
                    } else if (body.subscriptionPlanIdsCanReadUnreleased !== null) {
                        body.subscriptionPlanIdsCanReadUnreleased = (body.subscriptionPlanIdsCanReadUnreleased as unknown as string).split(',').map(subscriptionPlanId => Number.parseInt(subscriptionPlanId.trim()));
                    }
                }
                if (body.subscriptionPlanIdsCanReadReleased !== undefined) {
                    if (Array.isArray(body.subscriptionPlanIdsCanReadReleased)) {
                        body.subscriptionPlanIdsCanReadReleased = body.subscriptionPlanIdsCanReadReleased.map(subscriptionPlanId => Number.parseInt(subscriptionPlanId.toString()));
                    } else if (body.subscriptionPlanIdsCanReadReleased !== null) {
                        body.subscriptionPlanIdsCanReadReleased = (body.subscriptionPlanIdsCanReadReleased as unknown as string).split(',').map(subscriptionPlanId => Number.parseInt(subscriptionPlanId.trim()));
                    }
                }
            },
        }
    );
