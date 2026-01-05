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
        permissions,
        params: { mangaSlug, chapterNumber },
      }) => {
        const [manga, chapter] = await Promise.all([
          getMangaCustomBySlug(organizationId, mangaSlug),
          getChapter(organizationId, mangaSlug, chapterNumber),
        ]);

        if (!chapter) {
          throw new Error("Capitulo no encontrado.");
        }

        // Verificar acceso usando la función centralizada
        const accessCheck = checkChapterAccess(user, permissions, chapter, manga);

        // Si no tiene acceso, devolver error apropiado
        if (!accessCheck.hasAccess) {
          return {
            status: false,
            message: accessCheck.message,
            errorType: accessCheck.errorType
          };
        }

        const pages = await listPages(organizationId, mangaSlug, chapterNumber);

        return {
          status: true,
          data: pages,
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
