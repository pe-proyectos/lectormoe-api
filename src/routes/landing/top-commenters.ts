import { Elysia, t } from 'elysia';
import { getGlobalTopCommenters } from '../../controllers/landing/top-commenters';

export const router = () => new Elysia()
  .get(
    '/api/landing/top-commenters',
    async () => {
      const data = await getGlobalTopCommenters();
      return { status: true, data };
    },
    {
      response: t.Object({
        status: t.Boolean(),
        data: t.Array(t.Object({
          id: t.Number(),
          username: t.String(),
          slug: t.String(),
          imageUrl: t.Union([t.String(), t.Null()]),
          commentCount: t.Number(),
        })),
      }),
    }
  );
