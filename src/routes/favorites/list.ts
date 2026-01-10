import { Elysia, t } from "elysia";

import { loggedOptional } from "../../plugins/auth";
import { FavoritesListQuery } from "../../types/favorites/list";
import { listFavorites } from "../../controllers/favorites/list";

export const router = () =>
  new Elysia().use(loggedOptional()).get(
    "/api/favorites",
    async ({ logged, user, organizationId, query }) => {
      if (!logged || !user) {
        throw new Error('No autorizado');
      }
      // organizationId puede ser null si no se envió el header
      const { data, maxPage, total } = await listFavorites(
        organizationId,
        user.id,
        query
      );

      return {
        status: true,
        data: {
          items: data,
          maxPage,
          total,
        },
      };
    },
    {
      query: FavoritesListQuery,
      response: t.Object({
        status: t.Boolean(),
        data: t.Any(),
      }),
    }
  );
