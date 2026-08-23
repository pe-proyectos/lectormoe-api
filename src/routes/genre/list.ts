import { Elysia, t } from 'elysia';

import { listGenre } from '../../controllers/genre/list';

// Catálogo global de géneros: público y sin requerir organización (se usa en la
// búsqueda global y en el editor de manga de cualquier scan).
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
