import { Elysia, t } from 'elysia';

import { loggedUserOnly } from '../../plugins/auth';
import { createRanking } from '../../controllers/manga-custom/rank';


export const router = () => new Elysia()
    .use(loggedUserOnly())
    .post(
        '/api/manga-custom/:mangaSlug/rank',
        async ({ user, params: { mangaSlug }, body: { rank, comment } }) => {
            const ranking = await createRanking(mangaSlug, rank, comment, user.id);
            return { status: true, data: ranking };
        },
        {
            body: t.Object({
                rank: t.String({ enum: ['C', 'B', 'A', 'S'] }),
                comment: t.String(),
            }),
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
        }
    );
