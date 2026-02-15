import { Elysia, t } from 'elysia';
import { getPublicProfile, getPublicFavorites, getPublicFollowedScans } from '../../controllers/user/public-profile';

export const router = () => new Elysia()
  .get(
    '/api/user/profile/:slug',
    async ({ params, set }) => {
      const profile = await getPublicProfile(params.slug);

      if (!profile) {
        set.status = 404;
        return { status: false, error: 'Usuario no encontrado' };
      }

      return { status: true, data: profile };
    },
    {
      params: t.Object({
        slug: t.String(),
      }),
      response: t.Union([
        t.Object({
          status: t.Literal(true),
          data: t.Object({
            id: t.Number(),
            username: t.String(),
            slug: t.String(),
            imageUrl: t.Union([t.String(), t.Null()]),
            bannerUrl: t.Union([t.String(), t.Null()]),
            description: t.Union([t.String(), t.Null()]),
            createdAt: t.Date(),
            subscriptions: t.Array(t.Object({
              active: t.Boolean(),
              subscriptionPlan: t.Object({
                id: t.Number(),
                name: t.String(),
                price: t.Number(),
                organizationId: t.Number(),
              }),
            })),
            stats: t.Object({
              accountAge: t.Number(),
              activeDaysStreak: t.Number(),
              toRead: t.Number(),
              read: t.Number(),
              streak: t.Number(),
              favoriteGenre: t.Union([t.String(), t.Null()]),
              hoursEstimated: t.Number(),
              weekChaptersRead: t.Number(),
            }),
            achievements: t.Any(),
            commentRank: t.Any(),
          }),
        }),
        t.Object({
          status: t.Literal(false),
          error: t.String(),
        }),
      ]),
    }
  )
  .get(
    '/api/user/profile/:slug/favorites',
    async ({ params, set }) => {
      const favorites = await getPublicFavorites(params.slug);

      if (favorites === null) {
        set.status = 404;
        return { status: false, error: 'Usuario no encontrado' };
      }

      return { status: true, data: favorites };
    },
    {
      params: t.Object({
        slug: t.String(),
      }),
    }
  )
  .get(
    '/api/user/profile/:slug/followed-scans',
    async ({ params, set }) => {
      const scans = await getPublicFollowedScans(params.slug);

      if (scans === null) {
        set.status = 404;
        return { status: false, error: 'Usuario no encontrado' };
      }

      return { status: true, data: scans };
    },
    {
      params: t.Object({
        slug: t.String(),
      }),
    }
  );
