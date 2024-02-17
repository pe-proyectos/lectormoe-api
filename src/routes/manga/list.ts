import { Elysia, t } from 'elysia';

import { listManga } from '../../controllers/manga/list';

export const router = () => new Elysia()
    .get(
        '/api/manga',
        async () => {
            const data = await listManga();
            return { status: true, data };
        },
        {
            response: t.Object({
                status: t.Boolean(),
                data: t.Array(t.Any()),
            }),
        }
    );
