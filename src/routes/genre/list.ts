import { Elysia, t } from 'elysia';

import { listGenre } from '../../controllers/genre/list';

export const router = () => new Elysia()
    .get(
        '/api/genre',
        async () => {
            const data = await listGenre();
            return { status: true, data };
        },
        {
            response: t.Object({
                status: t.Boolean(),
                data: t.Array(t.Any()),
            }),
        }
    );
