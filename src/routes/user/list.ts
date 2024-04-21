import { Elysia, t } from 'elysia';

import { listUsers } from '../../controllers/user/list';

export const router = () => new Elysia()
    .get(
        '/api/users',
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
