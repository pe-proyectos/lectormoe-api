import { Elysia, t } from 'elysia';
import { getOrgTopCommenters } from '../../controllers/organization/top-commenters';
import { checkOrganizationBySlug } from '../../controllers/organization/check';

export const router = () => new Elysia()
  .get(
    '/api/organization/:slug/top-commenters',
    async ({ params, set }) => {
      const organization = await checkOrganizationBySlug(params.slug);
      if (!organization) {
        set.status = 404;
        return { status: false, data: [] };
      }
      const data = await getOrgTopCommenters(organization.id);
      return { status: true, data };
    },
    {
      params: t.Object({
        slug: t.String(),
      }),
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
