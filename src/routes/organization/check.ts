import { Elysia, t } from 'elysia';

import { checkOrganization } from '../../controllers/organization/check';
import { loggedOptional } from '../../plugins/auth';


export const router = () => new Elysia()
    .use(loggedOptional())
    .get(
        '/api/organization/check',
        async ({ query: { domain } }) => {
            if (!domain) {
                throw new Error('No se recibió el dominio.');
            }
            const organization = await checkOrganization(domain);
            if (!organization) {
                throw new Error(`No se encontró la organización '${domain}'.`);
            }
            return {
                status: true,
                data: organization,
            };
        },
        {
            query: t.Object({
                domain: t.String(),
            }),
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
        }
    );
