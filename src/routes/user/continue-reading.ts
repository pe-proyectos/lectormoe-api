import { Elysia } from 'elysia';
import { logged } from '../../plugins/auth';
import { getContinueReading } from '../../controllers/user/continue-reading';

export const router = () =>
  new Elysia()
    .use(logged())
    .get('/api/user/continue-reading', async ({ user }) => {
      const data = await getContinueReading(user.id);
      return { status: true, data };
    });
