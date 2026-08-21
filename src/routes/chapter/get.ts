import { Elysia, t } from 'elysia';

import { getChapter } from '../../controllers/chapter/get';
import { useOrganization } from '../../plugins/organization';
import { loggedOptional } from '../../plugins/auth';
import { getMangaCustomBySlug } from '../../controllers/manga-custom/get';
import { checkChapterAccess } from '../../util/access-control';

export const router = () => new Elysia()
    .use(useOrganization())
    .use(loggedOptional())
    .get(
        '/api/manga-custom/:mangaSlug/chapter/:chapterNumber',
        async ({ organizationId, user, params: { mangaSlug, chapterNumber } }) => {
            const permissions = user ? user.permissions.find((p: any) => p.organizationId === organizationId) : null;
            const [mangaCustom, chapter] = await Promise.all([
                getMangaCustomBySlug(organizationId, mangaSlug, user),
                getChapter(organizationId, mangaSlug, chapterNumber)
            ]);

            if (!mangaCustom) {
                throw new Error("Manga no encontrado.");
            }

            if (!chapter) {
                throw new Error("Capitulo no encontrado.");
            }

            // Verificar acceso usando la función centralizada
            const accessCheck = await checkChapterAccess(user, permissions, chapter, mangaCustom);

            return {
                status: true,
                data: {
                    ...chapter,
                    hasAccess: accessCheck.hasAccess,
                    accessDeniedReason: accessCheck.errorType,
                    accessDeniedMessage: accessCheck.message,
                    requiredPlans: accessCheck.requiredPlans
                }
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
