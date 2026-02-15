import { Elysia, t } from 'elysia';
import { logged } from '../../plugins/auth';
import { getUserAchievements } from '../../controllers/user/achievements';

export const router = () => new Elysia()
  .use(logged())
  .get(
    '/api/user/achievements',
    async ({ user }) => {
      const achievements = await getUserAchievements(user.id);
      return { status: true, data: achievements };
    },
  );
