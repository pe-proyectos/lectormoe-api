import { Elysia, t } from 'elysia';

import { autocompleteManga } from '../../controllers/manga/autocomplete';

export const router = () => new Elysia()
    .get(
        '/api/manga/autocomplete',
        async () => {
            const data = await autocompleteManga();
            return { status: true, data };
        },
        {
            response: t.Object({
                status: t.Boolean(),
                data: t.Array(t.Any()),
            }),
        }
    );
