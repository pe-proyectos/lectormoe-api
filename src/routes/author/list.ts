import { Elysia, t } from 'elysia';

import { listAuthor } from '../../controllers/author/list';

export const router = () => new Elysia()
    .get(
        '/api/author',
        async () => {
            const data = await listAuthor();
            return { status: true, data };
        },
        {
            response: t.Object({
                status: t.Boolean(),
                data: t.Array(t.Any()),
            }),
        }
    );
