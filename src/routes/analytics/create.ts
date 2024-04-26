import { Elysia, t } from 'elysia';

import { getIP } from '../../util/get-ip';
import { loggedOptional } from '../../plugins/auth';
import { createAnalytics } from '../../controllers/analytics/create';
import { CreateAnalyticsRequest } from '../../types/analytics/create';
import { useOrganization } from '../../plugins/organization';

export const router = () => new Elysia()
    .use(useOrganization())
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
