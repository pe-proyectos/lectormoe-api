import { Elysia, t } from "elysia";

import { loggedUserOnly } from "../../plugins/auth";
import { FavoritesListQuery } from "../../types/favorites/list";
import { listFavorites } from "../../controllers/favorites/list";

export const router = () =>
  new Elysia().use(loggedUserOnly()).get(
    "/api/favorites",
    async ({ organizationId, user, query }) => {
      const { data, maxPage, total } = await listFavorites(
        organizationId,
        user.id,
        query
      );

      return {
        status: true,
        data: {
          data,
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
