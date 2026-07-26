import { Elysia, t } from 'elysia';

import { getIP } from '../../util/get-ip';
import { loggedOptional } from '../../plugins/auth';
import { createAnalytics } from '../../controllers/analytics/create';
import { CreateAnalyticsRequest } from '../../types/analytics/create';
import { useOrganizationOptional } from '../../plugins/organization';

export const router = () => new Elysia()
    // Opcional: el dominio principal (sin scan) no tiene organización. Antes
    // lanzaba 500 y se perdía la telemetría global (p. ej. view_manga_search en
    // /search). Con el plugin opcional, organizationId queda null (la columna
    // Analytics.organizationId es nullable) y el evento se guarda igual.
    .use(useOrganizationOptional())
    .use(loggedOptional())
    .post(
        '/api/analytics',
        async ({ organizationId, user, request, body }) => {
            const ip = request.headers.get('ip') || getIP(request.headers) || "0.0.0.0";

            const created = await createAnalytics(organizationId, user?.id, body, ip);

            return {
                status: true,
                data: !!created,
            };
        },
        {
            body: CreateAnalyticsRequest,
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
            }),
        }
    );
