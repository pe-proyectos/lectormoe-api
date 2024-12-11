import { Elysia, t } from 'elysia';

import { CreateAuthorRequest } from '../../types/author/create';
import { createAuthor } from '../../controllers/author/create';
import { loggedUserOnly } from '../../plugins/auth';

export const router = () => new Elysia()
    .use(loggedUserOnly())
    .post(
        '/api/author',
        async ({ user, body }) => {
            if (!user.canCreateAuthor) {
                throw new Error("No tiene permisos para crear autores.");
            }

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
