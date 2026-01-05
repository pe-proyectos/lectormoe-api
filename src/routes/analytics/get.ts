import { Elysia, t } from 'elysia';

import { useOrganization } from '../../plugins/organization';
import { getAnalytics } from '../../controllers/analytics/get';
import { GetAnalyticsQuery } from '../../types/analytics/get';

// Caché simple en memoria con TTL de 5 minutos
const analyticsCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

export const router = () => new Elysia()
    .use(useOrganization())
    .get(
        '/api/analytics',
        async ({ organizationId, query }) => {
            // Generar clave de caché
            const cacheKey = `${organizationId}-${query.from || 'default'}-${query.to || 'default'}`;
            
            // Verificar si hay datos en caché y si son válidos
            const cached = analyticsCache.get(cacheKey);
            if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
                return {
                    status: true,
                    data: cached.data,
                    cached: true
                };
            }

            // Si no hay caché válido, consultar la BD
            const result = await getAnalytics(organizationId, query);

            // Guardar en caché
            analyticsCache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });

            // Limpiar caché viejo (más de 1 hora)
            for (const [key, value] of analyticsCache.entries()) {
                if (Date.now() - value.timestamp > 60 * 60 * 1000) {
                    analyticsCache.delete(key);
                }
            }

            return {
                status: true,
                data: result,
                cached: false
            };
        },
        {
            query: GetAnalyticsQuery,
            response: t.Object({
                status: t.Boolean(),
                data: t.Any(),
                cached: t.Optional(t.Boolean()),
            }),
        }
    );
