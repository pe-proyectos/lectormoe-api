import { Elysia, t } from 'elysia';
import { logged } from '../../plugins/auth';
import { getUserStats } from '../../controllers/user/stats';

export const router = () => new Elysia()
    .use(logged())
    .get(
        '/api/user/stats',
        async ({ user }) => {
            const stats = await getUserStats(user.id);
            
            return {
                status: true,
                data: stats,
            };
        },
        {
            response: t.Object({
                status: t.Boolean(),
                data: t.Object({
                    activeDays: t.Number(),
                    toRead: t.Number(),
                    read: t.Number(),
                    streak: t.Number(),
                    favoriteGenre: t.Union([t.String(), t.Null()]),
                    hoursEstimated: t.Number(),
                    weekChaptersRead: t.Number(),
                }),
            }),
        }
    );

