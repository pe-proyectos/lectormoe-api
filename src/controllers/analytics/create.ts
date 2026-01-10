import { prisma } from "../../models/prisma";
import type { CreateAnalyticsRequest } from "../../types/analytics/create";

function extractBrowserFromUserAgent(userAgent: string): string {
  const ua = userAgent.toLowerCase();

  if (ua.indexOf("opera") !== -1 || ua.indexOf("opr/") !== -1) return "opera";
  if (ua.indexOf("edg/") !== -1 || ua.indexOf("edge/") !== -1) return "edge";
  if (ua.indexOf("samsungbrowser") !== -1) return "samsung";
  if (ua.indexOf("ucbrowser") !== -1) return "uc";
  if (ua.indexOf("yabrowser") !== -1) return "yandex";
  if (ua.indexOf("vivaldi") !== -1) return "vivaldi";
  if (ua.indexOf("brave") !== -1) return "brave";
  if (ua.indexOf("whale") !== -1) return "whale";
  if (ua.indexOf("puffin") !== -1) return "puffin";
  if (ua.indexOf("qqbrowser") !== -1) return "qq";
  if (ua.indexOf("sogou") !== -1) return "sogou";
  if (ua.indexOf("lbbrowser") !== -1) return "liebao";
  if (ua.indexOf("maxthon") !== -1) return "maxthon";
  if (ua.indexOf("focus") !== -1) return "firefox-focus";
  if (ua.indexOf("duckduckgo") !== -1) return "duckduckgo";
  if (ua.indexOf("silk") !== -1) return "silk";
  if (ua.indexOf("miuibrowser") !== -1) return "miui";
  if (ua.indexOf("huaweibrowser") !== -1) return "huawei";
  if (ua.indexOf("firefox") !== -1) return "firefox";
  if (ua.indexOf("chrome") !== -1) return "chrome";
  if (ua.indexOf("safari") !== -1) return "safari";
  if (ua.indexOf("msie") !== -1 || ua.indexOf("trident/") !== -1) return "ie";

  return "other";
}

export const createAnalytics = async (
  organizationId: number,
  userId: number,
  request: CreateAnalyticsRequest,
  ip: string
) => {
  let deviceType = "desktop";

  if (
    /Mobile|Android|iPhone|iPod|BlackBerry|IEMobile|Windows Phone/i.test(
      request.userAgent
    )
  ) {
    deviceType = "mobile";
  } else if (/iPad|Tablet|PlayBook|KFAPWI/i.test(request.userAgent)) {
    deviceType = "tablet";
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
      browser: extractBrowserFromUserAgent(request?.userAgent),
      capturedAt: new Date(),
      payload: request?.payload,
    },
  });

  return true;
};
