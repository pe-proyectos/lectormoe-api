import UAParser from "ua-parser-js";
import { prisma } from "../../models/prisma";
import type { CreateAnalyticsRequest } from "../../types/analytics/create";

export const createAnalytics = async (organizationId: number, userId: number, request: CreateAnalyticsRequest, ip: string) => {
    const parser = new UAParser(request.userAgent);

    let deviceType = 'desktop';

    if (/Mobile|Android|iPhone|iPod|BlackBerry|IEMobile|Windows Phone/i.test(request.userAgent)) {
        deviceType = 'mobile';
    } else if (/iPad|Tablet|PlayBook|KFAPWI/i.test(request.userAgent)) {
        deviceType = 'tablet';
    }

    await prisma.analytics.create({
        data: {
            ip,
            userId,
            organizationId,
            event: request.event,
            path: request.path,
            userAgent: request.userAgent,
            screenWidth: request.screenWidth,
            screenHeight: request.screenHeight,
            deviceType,
            browser: parser.getBrowser().name,
            capturedAt: new Date(),
            payload: request?.payload,
        }
    });

    return true;
};
