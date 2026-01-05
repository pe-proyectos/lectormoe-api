import { Elysia, t } from 'elysia';

import { CreateAuthorRequest } from '../../types/author/create';
import { createAuthor } from '../../controllers/author/create';
import { loggedUserOnly } from '../../plugins/auth';
import { useOrganization } from '../../plugins/organization';

export const router = () => new Elysia()
    .use(loggedUserOnly())
    .use(useOrganization())
    .post(
        '/api/author',
        async ({ permissions, body, organizationId }) => {
            if (!permissions?.canCreateAuthor) {
                throw new Error("No tiene permisos para crear autores.");
            }

            const author = await createAuthor(body, organizationId);

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
