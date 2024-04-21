import { Elysia, t } from 'elysia';

import { CreateAuthorRequest } from '../../types/author/create';
import { createAuthor } from '../../controllers/author/create';
import { loggedMemberOnly } from '../../plugins/auth';

export const router = () => new Elysia()
    .use(loggedMemberOnly())
    .post(
        '/api/author',
        async ({ member, body }) => {
            if (!member.canCreateAuthor) {
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
