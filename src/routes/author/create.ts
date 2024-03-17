import { Elysia, t } from 'elysia';

import { CreateAuthorRequest } from '../../types/author/create';
import { createAuthor } from '../../controllers/author/create';

export const router = () => new Elysia()
    .post(
        '/api/author',
        async ({ body }) => {
            const author = await createAuthor(body);

            if (!author) {
                throw new Error("No se pudo crear el autor.");
            }

            return {
                status: true,
                data: author,
            };
        },
        {
            body: CreateAuthorRequest,
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
        }
    );
