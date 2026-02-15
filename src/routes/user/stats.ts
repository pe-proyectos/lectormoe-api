import { Elysia, t } from 'elysia';
import { logged } from '../../plugins/auth';
import { getUserStats } from '../../controllers/user/stats';
import { getCommentRank } from '../../controllers/user/achievements';

export const router = () => new Elysia()
    .use(logged())
    .get(
        '/api/user/stats',
        async ({ user }) => {
            const [stats, commentRank] = await Promise.all([
                getUserStats(user.id),
                getCommentRank(user.id),
            ]);

            return {
                status: true,
                data: { ...stats, commentRank },
            };
        },
        {
            response: t.Object({
                status: t.Boolean(),
                data: t.Object({
                    accountAge: t.Number(),
                    activeDaysStreak: t.Number(),
                    toRead: t.Number(),
                    read: t.Number(),
                    streak: t.Number(),
                    favoriteGenre: t.Union([t.String(), t.Null()]),
                    hoursEstimated: t.Number(),
                    weekChaptersRead: t.Number(),
                    commentRank: t.Any(),
                }),
            }),
        }
    );

