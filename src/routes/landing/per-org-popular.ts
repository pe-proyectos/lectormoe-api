import { Elysia, t } from 'elysia';
import { getPerOrgPopular } from '../../controllers/landing/per-org-popular';

export const router = () => new Elysia()
  .get(
    '/api/landing/per-org-popular',
    async () => {
      const data = await getPerOrgPopular();
      return { status: true, data };
    },
  );
