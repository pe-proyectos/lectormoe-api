import { Elysia, t } from 'elysia';

import { listBookType } from '../../controllers/book_type/list';

export const router = () => new Elysia()
    .get(
        '/api/book_type',
        async () => {
            const data = await listBookType();
            return { status: true, data };
        },
        {
            response: t.Object({
                status: t.Boolean(),
                data: t.Array(t.Any()),
            }),
        }
    );
