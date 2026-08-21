import { Elysia, t } from "elysia";

import { listPages } from "../../controllers/pages/list";
import { useOrganization } from "../../plugins/organization";
import { getChapter } from "../../controllers/chapter/get";
import { loggedOptional } from "../../plugins/auth";
import { getMangaCustomBySlug } from "../../controllers/manga-custom/get";
import { checkChapterAccess } from "../../util/access-control";

export const router = () =>
  new Elysia()
    .use(useOrganization())
    .use(loggedOptional())
    .get(
      "/api/manga-custom/:mangaSlug/chapter/:chapterNumber/pages",
      async ({
        organizationId,
        user,
        params: { mangaSlug, chapterNumber },
      }) => {
        const permissions = user ? user.permissions.find((p: any) => p.organizationId === organizationId) : null;
        const [mangaCustom, chapter] = await Promise.all([
          getMangaCustomBySlug(organizationId, mangaSlug),
          getChapter(organizationId, mangaSlug, chapterNumber),
        ]);

        if (!mangaCustom) {
          throw new Error("Manga no encontrado.");
        }

        if (!chapter) {
          throw new Error("Capitulo no encontrado.");
        }

        // Verificar acceso usando la función centralizada
        const accessCheck = await checkChapterAccess(user, permissions, chapter, mangaCustom);

        // Si no tiene acceso, devolver error apropiado
        if (!accessCheck.hasAccess) {
          return {
            status: false,
            message: accessCheck.message ?? "No tienes acceso a este capítulo.",
            errorType: accessCheck.errorType ?? "login_required",
            requiredPlans: accessCheck.requiredPlans,
          };
        }

        const pages = await listPages(organizationId, mangaSlug, chapterNumber);

        // Caso copyright (loggedInOnly): a los usuarios DESLOGUEADOS se les sirve
        // SOLO la copia difuminada (blurUrl) — nunca la imagen original. Así
        // Google/anónimos jamás reciben el original y se corta el DMCA. Los
        // usuarios logueados ven el original normal.
        const servedPages =
          (mangaCustom as any).loggedInOnly && !user
            ? pages.map((p: any) => ({
                ...p,
                // NUNCA el original: si aún no hay copia difuminada, se sirve
                // vacío (no se filtra el original a anónimos/Google).
                imageUrl: p.blurUrl || '',
                blurUrl: undefined,
                blurred: !!p.blurUrl,
              }))
            : pages;

        return {
          status: true,
          data: servedPages,
        };
      },
      {
        params: t.Object({
          mangaSlug: t.String(),
          chapterNumber: t.Number(),
        }),
        response: t.Object({
          status: t.Boolean(),
          data: t.Optional(t.Any()),
          message: t.Optional(t.String()),
          errorType: t.Optional(t.String()),
        }),
        transform({ params }) {
          params.chapterNumber = parseFloat(params.chapterNumber.toString());
        },
      }
    );
