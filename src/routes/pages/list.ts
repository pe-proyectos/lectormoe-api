import { Elysia, t } from 'elysia';

import { listPages } from '../../controllers/pages/list';
import { useOrganization } from '../../plugins/organization';
import { getChapter } from '../../controllers/chapter/get';
import { loggedOptional } from '../../plugins/auth';
import { getMangaCustomBySlug } from '../../controllers/manga-custom/get';

export const router = () => new Elysia()
    .use(useOrganization())
    .use(loggedOptional())
    .get(
        '/api/manga-custom/:mangaSlug/chapter/:chapterNumber/pages',
        async ({ organizationId, user, params: { mangaSlug, chapterNumber } }) => {
            const [manga, chapter] = await Promise.all([
                getMangaCustomBySlug(organizationId, mangaSlug),
                getChapter(organizationId, mangaSlug, chapterNumber)
            ]);

            if (!chapter) {
                throw new Error("Capitulo no encontrado.");
            }

            const userHasAccessToChapter = () => {
                if (new Date(chapter.releasedAt).getTime() < new Date().getTime() && chapter?.subscribersOnly !== true) return true;
                if (!user) return false;
                if (user?.canReadUnreleased === true) return true;
                if (user?.canEditChapter === true) return true;
                if (user?.canEditPage === true) return true;
                for (const subscription of user?.subscriptions || []) {
                    if (subscription?.subscriptionPlan?.canReadUnreleased === true) {
                        return true;
                    }
                    if (manga?.subscriptionPlans?.find((plan) => plan.id === subscription?.subscriptionPlan?.id)) {
                        return true;
                    }
                }
                return false;
            }

            if (!userHasAccessToChapter()) {
                throw new Error("No tiene permisos para leer capítulos sin publicar.");
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
