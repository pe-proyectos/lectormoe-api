import { Elysia, t } from 'elysia';

import { autocompleteManga } from '../../controllers/manga/autocomplete';

export const router = () => new Elysia()
    .get(
        '/api/manga/autocomplete',
        async ({ query }) => {
            const ck = query?.contentKind;
            const contentKind = ck === 'writing' || ck === 'manga' ? ck : undefined;
            const data = await autocompleteManga(contentKind);
            return { status: true, data };
        },
        {
            query: t.Optional(t.Object({ contentKind: t.Optional(t.String()) })),
            response: t.Object({
                status: t.Boolean(),
                data: t.Array(t.Any()),
            }),
        }
    );
