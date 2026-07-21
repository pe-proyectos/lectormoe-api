import { prisma } from "../../models/prisma";
import { GetAnalyticsQuery } from "../../types/analytics/get";

const daysNames = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];
const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const formatDateLabel = (d: Date) => `${daysNames[d.getDay()]} ${d.getDate()}, ${monthNames[d.getMonth()]}`;

// Caché en memoria del dashboard. Cada carga dispara 9 agregaciones sobre
// analytics (14M filas) y views (12.7M): ~6s y mucho I/O que desaloja el caché
// de Postgres y frena al resto del sitio. Los datos son de panel, no necesitan
// ser al segundo, así que se reutilizan durante ANALYTICS_CACHE_TTL_MS.
// Solo cachea rangos que terminan "ahora" (los históricos cerrados no cambian
// pero tampoco se piden a menudo; igual entran porque la clave incluye el rango).
const ANALYTICS_CACHE_TTL_MS = Number(process.env.ANALYTICS_CACHE_TTL_MS ?? 5 * 60 * 1000);
const ANALYTICS_CACHE_MAX_ENTRIES = 200;
const analyticsCache = new Map<string, { expiresAt: number; data: Record<string, any> }>();
const inFlight = new Map<string, Promise<Record<string, any>>>();

export const getAnalytics = async (organizationId: number, request: GetAnalyticsQuery) => {
    const cacheKey = `${organizationId}|${request.from ?? ''}|${request.to ?? ''}`;
    const cached = analyticsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    // Coalescing: si varios admins piden el mismo dashboard a la vez, se ejecuta
    // UNA sola vez y todos esperan el mismo resultado (evita la estampida que
    // agotaba el pool de conexiones).
    const running = inFlight.get(cacheKey);
    if (running) return running;

    const promise = computeAnalytics(organizationId, request)
        .then((data) => {
            if (analyticsCache.size >= ANALYTICS_CACHE_MAX_ENTRIES) {
                const oldest = analyticsCache.keys().next().value;
                if (oldest) analyticsCache.delete(oldest);
            }
            analyticsCache.set(cacheKey, { expiresAt: Date.now() + ANALYTICS_CACHE_TTL_MS, data });
            return data;
        })
        .finally(() => inFlight.delete(cacheKey));

    inFlight.set(cacheKey, promise);
    return promise;
};

const computeAnalytics = async (organizationId: number, request: GetAnalyticsQuery) => {
    const currentRange = {
        start: request.from ? new Date(request.from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        end: request.to ? new Date(request.to) : new Date(),
    };
    currentRange.start.setHours(0, 0, 0, 0);
    currentRange.end.setHours(23, 59, 59, 999);

    // Periodo anterior: misma duración antes del rango seleccionado
    const durationMs = currentRange.end.getTime() - currentRange.start.getTime();
    const prevRange = {
        start: new Date(currentRange.start.getTime() - durationMs),
        end: new Date(currentRange.start.getTime() - 1),
    };
    prevRange.start.setHours(0, 0, 0, 0);
    prevRange.end.setHours(23, 59, 59, 999);

    // Ejecutar todas las consultas en paralelo
    const [
        analyticsAggregated,
        mangaViews,
        summaryStats,
        prevSummaryStats,
        uniqueVisitorsOverTime,
        deviceDistribution,
        browserDistribution,
        topChapters,
        newUsersOverTime,
    ] = await Promise.all([
        // 1. Eventos analíticos agregados por día
        prisma.$queryRaw<any[]>`
            SELECT event, DATE("capturedAt") as date, COUNT(*) as count
            FROM "analytics"
            WHERE "organizationId" = ${organizationId}
                AND "capturedAt" >= ${currentRange.start}
                AND "capturedAt" <= ${currentRange.end}
                AND event IS NOT NULL
            GROUP BY event, DATE("capturedAt")
            ORDER BY DATE("capturedAt") ASC
        `,

        // 2. Vistas de manga (treemap)
        prisma.$queryRaw<any[]>`
            SELECT mc.id, mc.title, COUNT(*) as view_count
            FROM "views" v
            INNER JOIN "manga_custom" mc ON mc.id = v."mangaCustomId"
            WHERE mc."organizationId" = ${organizationId}
                AND v."viewedAt" >= ${currentRange.start}
                AND v."viewedAt" <= ${currentRange.end}
                AND v."mangaCustomId" IS NOT NULL
            GROUP BY mc.id, mc.title
            ORDER BY view_count DESC
            LIMIT 50
        `,

        // 3. Resumen periodo actual
        prisma.$queryRaw<any[]>`
            SELECT
                (SELECT COUNT(*) FROM "views" v
                    INNER JOIN "manga_custom" mc ON mc.id = v."mangaCustomId"
                    WHERE mc."organizationId" = ${organizationId}
                    AND v."viewedAt" >= ${currentRange.start} AND v."viewedAt" <= ${currentRange.end}
                ) as total_views,
                (SELECT COUNT(DISTINCT v.ip) FROM "views" v
                    INNER JOIN "manga_custom" mc ON mc.id = v."mangaCustomId"
                    WHERE mc."organizationId" = ${organizationId}
                    AND v."viewedAt" >= ${currentRange.start} AND v."viewedAt" <= ${currentRange.end}
                ) as unique_visitors,
                (SELECT COUNT(*) FROM "views" v
                    INNER JOIN "chapter" ch ON ch.id = v."chapterId"
                    INNER JOIN "manga_custom" mc ON mc.id = ch."mangaCustomId"
                    WHERE mc."organizationId" = ${organizationId}
                    AND v."viewedAt" >= ${currentRange.start} AND v."viewedAt" <= ${currentRange.end}
                ) as total_chapter_reads,
                (SELECT COUNT(*) FROM "manga_custom"
                    WHERE "organizationId" = ${organizationId}
                ) as total_mangas,
                (SELECT COUNT(*) FROM "analytics"
                    WHERE "organizationId" = ${organizationId}
                    AND "capturedAt" >= ${currentRange.start} AND "capturedAt" <= ${currentRange.end}
                ) as total_events
        `,

        // 4. Resumen periodo ANTERIOR (para comparación)
        prisma.$queryRaw<any[]>`
            SELECT
                (SELECT COUNT(*) FROM "views" v
                    INNER JOIN "manga_custom" mc ON mc.id = v."mangaCustomId"
                    WHERE mc."organizationId" = ${organizationId}
                    AND v."viewedAt" >= ${prevRange.start} AND v."viewedAt" <= ${prevRange.end}
                ) as total_views,
                (SELECT COUNT(DISTINCT v.ip) FROM "views" v
                    INNER JOIN "manga_custom" mc ON mc.id = v."mangaCustomId"
                    WHERE mc."organizationId" = ${organizationId}
                    AND v."viewedAt" >= ${prevRange.start} AND v."viewedAt" <= ${prevRange.end}
                ) as unique_visitors,
                (SELECT COUNT(*) FROM "views" v
                    INNER JOIN "chapter" ch ON ch.id = v."chapterId"
                    INNER JOIN "manga_custom" mc ON mc.id = ch."mangaCustomId"
                    WHERE mc."organizationId" = ${organizationId}
                    AND v."viewedAt" >= ${prevRange.start} AND v."viewedAt" <= ${prevRange.end}
                ) as total_chapter_reads,
                (SELECT COUNT(*) FROM "analytics"
                    WHERE "organizationId" = ${organizationId}
                    AND "capturedAt" >= ${prevRange.start} AND "capturedAt" <= ${prevRange.end}
                ) as total_events
        `,

        // 5. Visitantes únicos por día
        prisma.$queryRaw<any[]>`
            SELECT DATE(v."viewedAt") as date, COUNT(DISTINCT v.ip) as unique_count
            FROM "views" v
            INNER JOIN "manga_custom" mc ON mc.id = v."mangaCustomId"
            WHERE mc."organizationId" = ${organizationId}
                AND v."viewedAt" >= ${currentRange.start}
                AND v."viewedAt" <= ${currentRange.end}
            GROUP BY DATE(v."viewedAt")
            ORDER BY DATE(v."viewedAt") ASC
        `,

        // 6. Distribución por tipo de dispositivo
        prisma.$queryRaw<any[]>`
            SELECT COALESCE("deviceType", 'desconocido') as device_type, COUNT(*) as count
            FROM "analytics"
            WHERE "organizationId" = ${organizationId}
                AND "capturedAt" >= ${currentRange.start}
                AND "capturedAt" <= ${currentRange.end}
            GROUP BY "deviceType"
            ORDER BY count DESC
        `,

        // 7. Distribución por navegador
        prisma.$queryRaw<any[]>`
            SELECT COALESCE(browser, 'desconocido') as browser, COUNT(*) as count
            FROM "analytics"
            WHERE "organizationId" = ${organizationId}
                AND "capturedAt" >= ${currentRange.start}
                AND "capturedAt" <= ${currentRange.end}
                AND browser IS NOT NULL
            GROUP BY browser
            ORDER BY count DESC
            LIMIT 10
        `,

        // 8. Top capítulos más leídos
        prisma.$queryRaw<any[]>`
            SELECT mc.title as manga_title, ch.number as chapter_number, ch.title as chapter_title, COUNT(*) as read_count
            FROM "views" v
            INNER JOIN "chapter" ch ON ch.id = v."chapterId"
            INNER JOIN "manga_custom" mc ON mc.id = ch."mangaCustomId"
            WHERE mc."organizationId" = ${organizationId}
                AND v."viewedAt" >= ${currentRange.start}
                AND v."viewedAt" <= ${currentRange.end}
                AND v."chapterId" IS NOT NULL
            GROUP BY mc.title, ch.number, ch.title
            ORDER BY read_count DESC
            LIMIT 15
        `,

        // 9. Nuevos usuarios registrados por día
        prisma.$queryRaw<any[]>`
            SELECT DATE("capturedAt") as date, COUNT(*) as count
            FROM "analytics"
            WHERE "organizationId" = ${organizationId}
                AND "capturedAt" >= ${currentRange.start}
                AND "capturedAt" <= ${currentRange.end}
                AND event = 'action_register'
            GROUP BY DATE("capturedAt")
            ORDER BY DATE("capturedAt") ASC
        `,
    ]);

    // Procesar eventos analíticos agregados
    const result: Record<string, any> = {};
    const dateSortMap: Record<string, Record<string, number>> = {};

    for (const row of analyticsAggregated) {
        const event = row.event;
        const capturedAt = new Date(row.date);
        const count = Number(row.count);
        if (!result[event]) { result[event] = {}; dateSortMap[event] = {}; }
        const dateKey = formatDateLabel(capturedAt);
        if (!result[event][dateKey]) { result[event][dateKey] = 0; dateSortMap[event][dateKey] = capturedAt.getTime(); }
        result[event][dateKey] += count;
    }

    const formattedResult: Record<string, any> = {};
    for (const event in result) {
        const sortedLabels = Object.keys(result[event]).sort((a, b) => dateSortMap[event][a] - dateSortMap[event][b]);
        formattedResult[event] = {
            labels: sortedLabels,
            series: sortedLabels.map(label => result[event][label]),
        };
    }

    // Treemap
    formattedResult["manga_views_treemap"] = mangaViews.map(v => ({
        x: v.title || 'Desconocido',
        y: Number(v.view_count),
    }));

    // Resumen actual
    const s = summaryStats[0] || {};
    const current = {
        total_views: Number(s.total_views || 0),
        unique_visitors: Number(s.unique_visitors || 0),
        total_chapter_reads: Number(s.total_chapter_reads || 0),
        total_mangas: Number(s.total_mangas || 0),
        total_events: Number(s.total_events || 0),
    };
    formattedResult["summary"] = current;

    // Resumen periodo anterior + cálculo de cambio porcentual
    const p = prevSummaryStats[0] || {};
    const previous = {
        total_views: Number(p.total_views || 0),
        unique_visitors: Number(p.unique_visitors || 0),
        total_chapter_reads: Number(p.total_chapter_reads || 0),
        total_events: Number(p.total_events || 0),
    };

    const pctChange = (curr: number, prev: number) => prev === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - prev) / prev) * 100);

    formattedResult["comparison"] = {
        previous,
        changes: {
            total_views: pctChange(current.total_views, previous.total_views),
            unique_visitors: pctChange(current.unique_visitors, previous.unique_visitors),
            total_chapter_reads: pctChange(current.total_chapter_reads, previous.total_chapter_reads),
            total_events: pctChange(current.total_events, previous.total_events),
        },
    };

    // Visitantes únicos por día
    formattedResult["unique_visitors_over_time"] = {
        labels: uniqueVisitorsOverTime.map(row => formatDateLabel(new Date(row.date))),
        series: uniqueVisitorsOverTime.map(row => Number(row.unique_count)),
    };

    // Distribución por dispositivo
    formattedResult["device_distribution"] = deviceDistribution.map(row => ({
        id: row.device_type || 'desconocido',
        label: row.device_type || 'Desconocido',
        value: Number(row.count),
    }));

    // Distribución por navegador
    formattedResult["browser_distribution"] = browserDistribution.map(row => ({
        id: row.browser || 'desconocido',
        label: row.browser || 'Desconocido',
        value: Number(row.count),
    }));

    // Top capítulos
    formattedResult["top_chapters"] = topChapters.map(row => ({
        manga: row.manga_title,
        chapter: row.chapter_number,
        title: row.chapter_title || `Cap. ${row.chapter_number}`,
        label: `${row.manga_title} #${row.chapter_number}`,
        reads: Number(row.read_count),
    }));

    // Nuevos usuarios por día
    formattedResult["new_users_over_time"] = {
        labels: newUsersOverTime.map(row => formatDateLabel(new Date(row.date))),
        series: newUsersOverTime.map(row => Number(row.count)),
    };

    return formattedResult;
};
