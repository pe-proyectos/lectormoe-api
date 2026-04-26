import { Elysia, t } from 'elysia';
import { getPerOrgPopular } from '../../controllers/landing/per-org-popular';

export const router = () => new Elysia()
  .get(
    '/api/landing/per-org-popular',
    async ({ query }) => {
      const nsfw = query?.nsfw === 'true';
      const contentKind = (query?.contentKind === 'writing' || query?.contentKind === 'manga')
        ? query.contentKind
        : 'all';
      const data = await getPerOrgPopular(nsfw, contentKind);
      return { status: true, data };
    },
    {
      query: t.Optional(t.Object({
        nsfw: t.Optional(t.String()),
        contentKind: t.Optional(t.String()),
      })),
    },
  );
