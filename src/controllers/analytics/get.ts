import { prisma } from "../../models/prisma";
import { GetAnalyticsQuery } from "../../types/analytics/get";

export const getAnalytics = async (organizationId: number, request: GetAnalyticsQuery) => {
    const defaultDateRange = {
        start: request.from ? new Date(request.from) : new Date(new Date().getTime() - 1000 * 60 * 60 * 24 * 7),
        end: request.to ? new Date(request.to) : new Date(),
    };

    defaultDateRange.start.setHours(0, 0, 0, 0);
    defaultDateRange.end.setHours(23, 59, 59, 999);

    const analytics = await prisma.analytics.findMany({
        where: {
            organizationId,
            capturedAt: {
                gte: defaultDateRange.start,
                lte: defaultDateRange.end,
            },
        },
        select: {
            event: true,
            path: true,
            deviceType: true,
            capturedAt: true,
        }
    });

    const data: Record<string, any> = {};

    for (let i = 0; i < analytics.length; i++) {
        const event = analytics[i]?.event;
        if (!event) continue;
        if (!data[event]) {
            data[event] = {};
        }
        const capturedAt = new Date(analytics[i]?.capturedAt);
        const daysNames = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const dateKey = `${daysNames[capturedAt.getDay()]} ${capturedAt.getDate()}, ${monthNames[capturedAt.getMonth()]}`;
        if (!data[event][dateKey]) {
            data[event][dateKey] = 0;
        }
        data[event][dateKey] += 1;
    }

    const result: Record<string, any> = {};
    for (const event in data) {
        const sortedLabels = Object.keys(data[event]).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
        result[event] = {
            labels: sortedLabels,
            series: sortedLabels.map(label => data[event][label]),
        };
    }

    const mangaCustoms = await prisma.mangaCustom.findMany({
        where: {
            organizationId,
        },
        select: {
            id: true,
            title: true,
        },
    });

    const mangaViews = await prisma.viewsHistory.groupBy({
        by: ['mangaCustomId'],
        where: {
            mangaCustom: {
                organizationId,
            },
            viewedAt: {
                gte: defaultDateRange.start,
                lte: defaultDateRange.end,
            },
        },
        _count: {
            _all: true,
        }
    });

    result["manga_views_treemap"] = mangaViews.sort((a, b) => b._count._all - a._count._all).map(views => {
        return {
            x: mangaCustoms.find(manga => manga.id === views.mangaCustomId)?.title,
            y: views._count._all,
        }
    });

    return result;
};
