import { Elysia, t } from 'elysia';

import { listDemography } from '../../controllers/demography/list';

export const router = () => new Elysia()
    .get(
        '/api/demography',
        async () => {
            const data = await listDemography();
            return { status: true, data };
        },
        {
            response: t.Object({
                status: t.Boolean(),
                data: t.Array(t.Any()),
            }),
        }
    );
