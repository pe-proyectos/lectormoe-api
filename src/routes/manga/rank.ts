import { Elysia, t } from 'elysia';

import { authMiddleware } from '../../plugins/auth';
import { createRanking } from '../../controllers/manga/rank';


export const router = () => new Elysia()
    .use(authMiddleware({ loggedOnly: false }))
    .post(
        '/api/manga/:manga_slug/rank',
        async ({ user, params: { manga_slug }, body: { rank, comment } }) => {
            const ranking = await createRanking(manga_slug, rank, comment, user?.id || undefined);
            return { status: true, message: 'OK' };
        },
        {
            body: t.Object({
                rank: t.String({ enum: ['C', 'B', 'A', 'S'] }),
                comment: t.String(),
            }),
            response: t.Object({
                status: t.Boolean(),
                message: t.String(),
            }),
        }
    );
