import { Elysia } from "elysia";
import { cron } from "@elysiajs/cron";
import { prisma } from "../../models/prisma";
import { sendEmail, sendBatchEmails, BASE_URL } from "../../services/email";
import { canSendEmail, getUnsubscribeUrl } from "../../services/email-preferences";
import * as templates from "../../services/email-templates";

// ──────────── Daily Digest ────────────
// Runs at 2 PM UTC (~8-10 AM LATAM)
async function processDailyDigest() {
  try {
    console.log("[Email Cron] Starting daily digest...");

    const users = await prisma.user.findMany({
      where: { emailNotifications: true },
      select: { id: true, email: true, username: true },
    });

    let sent = 0;

    for (const user of users) {
      try {
        const allowed = await canSendEmail(user.id, "daily_digest");
        if (!allowed) continue;

        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

        // 1. New chapters from favorited mangas in last 24h
        const favorites = await prisma.favorite.findMany({
          where: { userId: user.id },
          select: { mangaCustomId: true },
        });

        const favIds = favorites.map((f) => f.mangaCustomId);
        if (favIds.length === 0) continue; // Skip users with no favorites

        const newChapters = await prisma.chapter.findMany({
          where: {
            mangaCustomId: { in: favIds },
            releasedAt: { gte: since },
            isUnreleased: false,
          },
          include: {
            mangaCustom: {
              include: {
                manga: { select: { slug: true } },
                organization: { select: { name: true, slug: true } },
              },
            },
          },
          orderBy: { releasedAt: "desc" },
          take: 10,
        });

        // 2. Unfinished manga (started but not finished recently)
        const unfinishedHistory = await prisma.userChapterHistory.findMany({
          where: {
            userId: user.id,
            finishedAt: null,
            lastReadAt: { not: null },
          },
          include: {
            chapter: {
              include: {
                mangaCustom: {
                  include: {
                    manga: { select: { slug: true } },
                    organization: { select: { slug: true } },
                  },
                },
              },
            },
          },
          orderBy: { lastReadAt: "desc" },
          take: 5,
        });

        // Deduplicate by mangaCustomId
        const seenManga = new Set<number>();
        const unfinished = unfinishedHistory
          .filter((h) => {
            if (seenManga.has(h.chapter.mangaCustomId)) return false;
            seenManga.add(h.chapter.mangaCustomId);
            return true;
          })
          .slice(0, 5);

        // 3. Recommendations based on favorite genres
        const favGenres = await prisma.mangaCustom.findMany({
          where: { id: { in: favIds } },
          select: { genres: { select: { id: true, name: true } } },
        });
        const genreIds = [
          ...new Set(favGenres.flatMap((m) => m.genres.map((g) => g.id))),
        ];
        const genreNames = new Map(
          favGenres.flatMap((m) => m.genres.map((g) => [g.id, g.name] as const))
        );

        const recommendations =
          genreIds.length > 0
            ? await prisma.mangaCustom.findMany({
                where: {
                  id: { notIn: favIds },
                  genres: { some: { id: { in: genreIds } } },
                  visibility: "public",
                },
                include: {
                  manga: { select: { slug: true } },
                  organization: { select: { slug: true } },
                  genres: { select: { id: true, name: true } },
                },
                orderBy: { views: "desc" },
                take: 5,
              })
            : [];

        const chaptersData = newChapters.map((ch) => ({
          mangaTitle: ch.mangaCustom.title,
          chapterNumber: String(ch.number),
          imageUrl: ch.mangaCustom.imageUrl,
          readUrl: `${BASE_URL}/${ch.mangaCustom.organization.slug}/manga/${ch.mangaCustom.manga.slug}/chapters/${ch.number}`,
          orgName: ch.mangaCustom.organization.name,
        }));

        const unfinishedData = unfinished.map((h) => ({
          mangaTitle: h.chapter.mangaCustom.title,
          imageUrl: h.chapter.mangaCustom.imageUrl,
          lastChapter: String(h.chapter.number),
          readUrl: `${BASE_URL}/${h.chapter.mangaCustom.organization.slug}/manga/${h.chapter.mangaCustom.manga.slug}`,
        }));

        const recsData = recommendations.map((r) => ({
          mangaTitle: r.title,
          imageUrl: r.imageUrl,
          readUrl: `${BASE_URL}/${r.organization.slug}/manga/${r.manga.slug}`,
          genre:
            r.genres.find((g) => genreIds.includes(g.id))?.name ||
            r.genres[0]?.name ||
            "",
        }));

        // Only send if there's content
        if (
          chaptersData.length === 0 &&
          unfinishedData.length === 0 &&
          recsData.length === 0
        )
          continue;

        const unsubscribeUrl = await getUnsubscribeUrl(user.id, 'daily_digest');
        const html = templates.dailyDigestTemplate(
          user.username,
          chaptersData,
          unfinishedData,
          recsData,
          unsubscribeUrl
        );

        await sendEmail({
          userId: user.id,
          to: user.email,
          subject: "Tu Resumen Diario - Capibara Traductor",
          html,
          emailType: "daily_digest",
          dedupWindowMinutes: 1200, // ~20 hours
        });
        sent++;
      } catch (error) {
        console.error(
          `[Email Cron] Error processing daily digest for user ${user.id}:`,
          error
        );
      }
    }

    console.log(`[Email Cron] Daily digest complete. Sent to ${sent} users.`);
  } catch (error) {
    console.error("[Email Cron] Critical error in daily digest:", error);
  }
}

// ──────────── Weekly Reading Summary ────────────
// Runs Monday at 3 PM UTC
async function processWeeklyReadingSummary() {
  try {
    console.log("[Email Cron] Starting weekly reading summary...");

    const users = await prisma.user.findMany({
      where: { emailNotifications: true },
      select: { id: true, email: true, username: true },
    });

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let sent = 0;

    for (const user of users) {
      try {
        const allowed = await canSendEmail(user.id, "weekly_reading_summary");
        if (!allowed) continue;

        // Chapters read this week
        const chaptersThisWeek = await prisma.userChapterHistory.findMany({
          where: {
            userId: user.id,
            lastReadAt: { gte: weekAgo },
          },
          include: {
            chapter: {
              include: {
                mangaCustom: {
                  include: { genres: { select: { name: true } } },
                },
              },
            },
          },
        });

        if (chaptersThisWeek.length === 0) continue;

        // Unique mangas read
        const mangasRead = new Set(
          chaptersThisWeek.map((h) => h.chapter.mangaCustomId)
        ).size;

        // Reading streak (consecutive days)
        const allHistory = await prisma.userChapterHistory.findMany({
          where: {
            userId: user.id,
            lastReadAt: { not: null },
          },
          select: { lastReadAt: true },
          orderBy: { lastReadAt: "desc" },
        });

        let streakDays = 0;
        if (allHistory.length > 0) {
          const today = new Date();
          today.setUTCHours(0, 0, 0, 0);
          const readDates = new Set(
            allHistory.map((h) => {
              const d = new Date(h.lastReadAt!);
              d.setUTCHours(0, 0, 0, 0);
              return d.getTime();
            })
          );
          for (let i = 0; i < 365; i++) {
            const checkDate = new Date(today.getTime() - i * 86400000);
            if (readDates.has(checkDate.getTime())) {
              streakDays++;
            } else if (i > 0) {
              break;
            }
          }
        }

        // Top genre this week
        const genreCounts = new Map<string, number>();
        for (const h of chaptersThisWeek) {
          for (const g of h.chapter.mangaCustom.genres) {
            genreCounts.set(g.name, (genreCounts.get(g.name) || 0) + 1);
          }
        }
        const topGenre =
          genreCounts.size > 0
            ? [...genreCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
            : null;

        // Percentile (approximate)
        const totalActiveReaders = await prisma.userChapterHistory.groupBy({
          by: ["userId"],
          where: { lastReadAt: { gte: weekAgo } },
        });
        const readerCounts = await Promise.all(
          totalActiveReaders.map(async (r) => {
            const count = await prisma.userChapterHistory.count({
              where: { userId: r.userId, lastReadAt: { gte: weekAgo } },
            });
            return { userId: r.userId, count };
          })
        );
        readerCounts.sort((a, b) => b.count - a.count);
        const userRank =
          readerCounts.findIndex((r) => r.userId === user.id) + 1;
        const percentile =
          readerCounts.length > 1
            ? Math.round(
                ((readerCounts.length - userRank) / readerCounts.length) * 100
              )
            : null;

        const unsubscribeUrl = await getUnsubscribeUrl(user.id, 'weekly_reading_summary');
        const html = templates.weeklyReadingSummaryTemplate(
          user.username,
          {
            chaptersRead: chaptersThisWeek.length,
            mangasRead,
            streakDays,
            topGenre,
            percentile,
          },
          unsubscribeUrl
        );

        await sendEmail({
          userId: user.id,
          to: user.email,
          subject: "Tu Semana en Numeros - Capibara Traductor",
          html,
          emailType: "weekly_reading_summary",
          dedupWindowMinutes: 10000, // ~7 days
        });
        sent++;
      } catch (error) {
        console.error(
          `[Email Cron] Error processing weekly summary for user ${user.id}:`,
          error
        );
      }
    }

    console.log(
      `[Email Cron] Weekly reading summary complete. Sent to ${sent} users.`
    );
  } catch (error) {
    console.error(
      "[Email Cron] Critical error in weekly reading summary:",
      error
    );
  }
}

// ──────────── Weekly Organization Report ────────────
// Runs Monday at 3 PM UTC
async function processWeeklyOrgReport() {
  try {
    console.log("[Email Cron] Starting weekly org reports...");

    const organizations = await prisma.organization.findMany({
      where: { isPublic: true },
      select: { id: true, name: true, slug: true },
    });

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    let sent = 0;

    // Pre-calculate platform average views for comparison
    const allOrgViews = await prisma.viewsHistory.groupBy({
      by: ["mangaCustomId"],
      where: { viewedAt: { gte: weekAgo } },
      _count: true,
    });

    // Group views by organization
    const orgViewMap = new Map<number, number>();
    if (allOrgViews.length > 0) {
      const mcToOrg = await prisma.mangaCustom.findMany({
        where: {
          id: { in: allOrgViews.map((v) => v.mangaCustomId).filter(Boolean) as number[] },
        },
        select: { id: true, organizationId: true },
      });
      const mcOrgMap = new Map(mcToOrg.map((m) => [m.id, m.organizationId]));
      for (const v of allOrgViews) {
        if (!v.mangaCustomId) continue;
        const orgId = mcOrgMap.get(v.mangaCustomId);
        if (orgId) orgViewMap.set(orgId, (orgViewMap.get(orgId) || 0) + v._count);
      }
    }
    const platformAvgViews =
      orgViewMap.size > 0
        ? [...orgViewMap.values()].reduce((a, b) => a + b, 0) /
          orgViewMap.size
        : 0;

    for (const org of organizations) {
      try {
        // Find staff with admin panel access
        const staffPermissions = await prisma.permission.findMany({
          where: {
            organizationId: org.id,
            canSeeAdminPanel: true,
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                username: true,
                emailNotifications: true,
              },
            },
          },
        });

        const eligibleStaff = [];
        for (const p of staffPermissions) {
          if (p.user.emailNotifications) {
            const allowed = await canSendEmail(
              p.user.id,
              "weekly_org_report"
            );
            if (allowed) eligibleStaff.push(p.user);
          }
        }

        if (eligibleStaff.length === 0) continue;

        // Get org manga IDs
        const orgMangas = await prisma.mangaCustom.findMany({
          where: { organizationId: org.id },
          select: { id: true, title: true },
        });
        const orgMangaIds = orgMangas.map((m) => m.id);

        if (orgMangaIds.length === 0) continue;

        // Views this week
        const viewsThisWeek = await prisma.viewsHistory.count({
          where: {
            mangaCustomId: { in: orgMangaIds },
            viewedAt: { gte: weekAgo },
          },
        });

        // Views previous week
        const viewsPrevWeek = await prisma.viewsHistory.count({
          where: {
            mangaCustomId: { in: orgMangaIds },
            viewedAt: { gte: twoWeeksAgo, lt: weekAgo },
          },
        });

        // Unique visitors this week
        const visitorsThisWeek = await prisma.viewsHistory.findMany({
          where: {
            mangaCustomId: { in: orgMangaIds },
            viewedAt: { gte: weekAgo },
          },
          distinct: ["ip"],
          select: { ip: true },
        });

        const visitorsPrevWeek = await prisma.viewsHistory.findMany({
          where: {
            mangaCustomId: { in: orgMangaIds },
            viewedAt: { gte: twoWeeksAgo, lt: weekAgo },
          },
          distinct: ["ip"],
          select: { ip: true },
        });

        // New followers this week
        const newFollowersThisWeek = await prisma.organizationFollower.count({
          where: {
            organizationId: org.id,
            createdAt: { gte: weekAgo },
          },
        });

        const newFollowersPrevWeek = await prisma.organizationFollower.count({
          where: {
            organizationId: org.id,
            createdAt: { gte: twoWeeksAgo, lt: weekAgo },
          },
        });

        // Revenue this week
        const revenueThisWeek = await prisma.organizationTransaction.aggregate(
          {
            where: {
              organizationId: org.id,
              status: "COMPLETED",
              transactionDate: { gte: weekAgo },
            },
            _sum: { amount: true },
          }
        );

        const revenuePrevWeek = await prisma.organizationTransaction.aggregate(
          {
            where: {
              organizationId: org.id,
              status: "COMPLETED",
              transactionDate: { gte: twoWeeksAgo, lt: weekAgo },
            },
            _sum: { amount: true },
          }
        );

        // Active subscribers
        const activeSubscribers = await prisma.subscription.count({
          where: { organizationId: org.id, active: true },
        });

        const prevSubscribers = await prisma.subscription.count({
          where: {
            organizationId: org.id,
            active: true,
            createdAt: { lt: weekAgo },
          },
        });

        // Top manga by views
        const topMangaViews = await prisma.viewsHistory.groupBy({
          by: ["mangaCustomId"],
          where: {
            mangaCustomId: { in: orgMangaIds },
            viewedAt: { gte: weekAgo },
          },
          _count: true,
          orderBy: { _count: { mangaCustomId: "desc" } },
          take: 5,
        });

        const mangaTitleMap = new Map(
          orgMangas.map((m) => [m.id, m.title])
        );

        const topManga = topMangaViews
          .filter((v) => v.mangaCustomId)
          .map((v) => ({
            title: mangaTitleMap.get(v.mangaCustomId!) || "Desconocido",
            views: v._count,
          }));

        // Top chapters by reads
        const topChapterReads = await prisma.userChapterHistory.groupBy({
          by: ["chapterId"],
          where: {
            chapter: { mangaCustomId: { in: orgMangaIds } },
            lastReadAt: { gte: weekAgo },
          },
          _count: true,
          orderBy: { _count: { chapterId: "desc" } },
          take: 5,
        });

        const topChapterIds = topChapterReads.map((c) => c.chapterId);
        const topChaptersData =
          topChapterIds.length > 0
            ? await prisma.chapter.findMany({
                where: { id: { in: topChapterIds } },
                include: { mangaCustom: { select: { title: true } } },
              })
            : [];
        const chapterMap = new Map(
          topChaptersData.map((c) => [c.id, c])
        );

        const topChapters = topChapterReads.map((cr) => {
          const ch = chapterMap.get(cr.chapterId);
          return {
            manga: ch?.mangaCustom.title || "Desconocido",
            chapter: `Cap. ${ch?.number || "?"}`,
            reads: cr._count,
          };
        });

        // Helper for change percentages
        function changeStr(current: number, previous: number): string {
          if (previous === 0) return current > 0 ? "+100%" : "0%";
          const pct = Math.round(((current - previous) / previous) * 100);
          return pct >= 0 ? `+${pct}%` : `${pct}%`;
        }

        const revenue = revenueThisWeek._sum.amount || 0;
        const prevRevenue = revenuePrevWeek._sum.amount || 0;

        const stats = {
          totalViews: viewsThisWeek,
          viewsChange: changeStr(viewsThisWeek, viewsPrevWeek),
          uniqueVisitors: visitorsThisWeek.length,
          visitorsChange: changeStr(
            visitorsThisWeek.length,
            visitorsPrevWeek.length
          ),
          newFollowers: newFollowersThisWeek,
          followersChange: changeStr(
            newFollowersThisWeek,
            newFollowersPrevWeek
          ),
          revenue,
          revenueChange: changeStr(revenue, prevRevenue),
          activeSubscribers,
          subscribersChange: changeStr(activeSubscribers, prevSubscribers),
          topManga,
          topChapters,
          platformAvgViews: Math.round(platformAvgViews),
        };

        const emails = await Promise.all(
          eligibleStaff.map(async (staff) => {
            const unsubscribeUrl = await getUnsubscribeUrl(staff.id, 'weekly_org_report');
            const html = templates.weeklyOrgReportTemplate(
              org.name,
              staff.username,
              stats,
              unsubscribeUrl
            );
            return {
              userId: staff.id,
              to: staff.email,
              subject: `Reporte Semanal - ${org.name}`,
              html,
              emailType: "weekly_org_report",
              metadata: { organizationId: org.id },
              dedupWindowMinutes: 10000,
            };
          })
        );

        await sendBatchEmails(emails);
        sent += emails.length;
      } catch (error) {
        console.error(
          `[Email Cron] Error processing org report for ${org.slug}:`,
          error
        );
      }
    }

    console.log(
      `[Email Cron] Weekly org reports complete. Sent ${sent} emails.`
    );
  } catch (error) {
    console.error("[Email Cron] Critical error in weekly org reports:", error);
  }
}

// ──────────── Re-engagement ────────────
// Runs daily at 6 PM UTC
async function processReEngagement() {
  try {
    console.log("[Email Cron] Starting re-engagement...");

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let sent = 0;

    // Find users who haven't read in 7+ days but have reading history
    const activeUserIds = await prisma.userChapterHistory.groupBy({
      by: ["userId"],
      where: { lastReadAt: { gte: sevenDaysAgo } },
    });
    const activeIds = new Set(activeUserIds.map((u) => u.userId));

    // Get users with history but inactive for 7+ days
    const allUsersWithHistory = await prisma.userChapterHistory.groupBy({
      by: ["userId"],
      where: { lastReadAt: { not: null } },
    });

    const inactiveUserIds = allUsersWithHistory
      .filter((u) => !activeIds.has(u.userId))
      .map((u) => u.userId);

    if (inactiveUserIds.length === 0) {
      console.log("[Email Cron] No inactive users found for re-engagement.");
      return;
    }

    const users = await prisma.user.findMany({
      where: {
        id: { in: inactiveUserIds },
        emailNotifications: true,
      },
      select: { id: true, email: true, username: true },
    });

    for (const user of users) {
      try {
        const allowed = await canSendEmail(user.id, "re_engagement");
        if (!allowed) continue;

        // Check dedup: max 1 re-engagement per 14 days
        const fourteenDaysAgo = new Date(
          Date.now() - 14 * 24 * 60 * 60 * 1000
        );
        const recentReEngagement = await prisma.emailLog.findFirst({
          where: {
            userId: user.id,
            emailType: "re_engagement",
            createdAt: { gte: fourteenDaysAgo },
          },
        });
        if (recentReEngagement) continue;

        // Find missed chapters from favorites
        const favorites = await prisma.favorite.findMany({
          where: { userId: user.id },
          select: { mangaCustomId: true },
        });

        const favIds = favorites.map((f) => f.mangaCustomId);
        if (favIds.length === 0) continue;

        // Get last read date for this user
        const lastRead = await prisma.userChapterHistory.findFirst({
          where: { userId: user.id, lastReadAt: { not: null } },
          orderBy: { lastReadAt: "desc" },
          select: { lastReadAt: true },
        });

        const missedSince = lastRead?.lastReadAt || sevenDaysAgo;

        // Chapters released since they left
        const missedChaptersRaw = await prisma.chapter.findMany({
          where: {
            mangaCustomId: { in: favIds },
            releasedAt: { gte: missedSince },
            isUnreleased: false,
          },
          include: {
            mangaCustom: {
              include: {
                manga: { select: { slug: true } },
                organization: { select: { slug: true } },
              },
            },
          },
        });

        // Group by manga and count chapters
        const missedByManga = new Map<
          number,
          {
            title: string;
            count: number;
            imageUrl: string | null;
            readUrl: string;
          }
        >();
        for (const ch of missedChaptersRaw) {
          const mc = ch.mangaCustom;
          const existing = missedByManga.get(mc.id);
          if (existing) {
            existing.count++;
          } else {
            missedByManga.set(mc.id, {
              title: mc.title,
              count: 1,
              imageUrl: mc.imageUrl,
              readUrl: `${BASE_URL}/${mc.organization.slug}/manga/${mc.manga.slug}`,
            });
          }
        }

        const missedChapters = [...missedByManga.values()]
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
          .map((m) => ({
            mangaTitle: m.title,
            chapterCount: m.count,
            imageUrl: m.imageUrl,
            readUrl: m.readUrl,
          }));

        // Simple recommendations
        const favGenres = await prisma.mangaCustom.findMany({
          where: { id: { in: favIds } },
          select: { genres: { select: { id: true, name: true } } },
        });
        const genreIds = [
          ...new Set(favGenres.flatMap((m) => m.genres.map((g) => g.id))),
        ];

        const recommendations =
          genreIds.length > 0
            ? await prisma.mangaCustom.findMany({
                where: {
                  id: { notIn: favIds },
                  genres: { some: { id: { in: genreIds } } },
                  visibility: "public",
                },
                include: {
                  manga: { select: { slug: true } },
                  organization: { select: { slug: true } },
                  genres: { select: { name: true } },
                },
                orderBy: { views: "desc" },
                take: 3,
              })
            : [];

        const recsData = recommendations.map((r) => ({
          mangaTitle: r.title,
          imageUrl: r.imageUrl,
          readUrl: `${BASE_URL}/${r.organization.slug}/manga/${r.manga.slug}`,
          genre: r.genres[0]?.name || "",
        }));

        if (missedChapters.length === 0 && recsData.length === 0) continue;

        const unsubscribeUrl = await getUnsubscribeUrl(user.id, 're_engagement');
        const html = templates.reEngagementTemplate(
          user.username,
          missedChapters,
          recsData,
          unsubscribeUrl
        );

        await sendEmail({
          userId: user.id,
          to: user.email,
          subject: "Te Echamos de Menos! - Capibara Traductor",
          html,
          emailType: "re_engagement",
          dedupWindowMinutes: 20160, // 14 days
        });
        sent++;
      } catch (error) {
        console.error(
          `[Email Cron] Error processing re-engagement for user ${user.id}:`,
          error
        );
      }
    }

    console.log(
      `[Email Cron] Re-engagement complete. Sent to ${sent} users.`
    );
  } catch (error) {
    console.error("[Email Cron] Critical error in re-engagement:", error);
  }
}

// ──────────── Reading Streak Milestones ────────────
// Runs daily at midnight UTC
async function processReadingStreaks() {
  try {
    console.log("[Email Cron] Starting reading streak check...");

    const milestones = [7, 14, 30, 60, 100, 365];
    let sent = 0;

    // Get users who read yesterday (potential streak holders)
    const yesterday = new Date();
    yesterday.setUTCHours(0, 0, 0, 0);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const yesterdayReaders = await prisma.userChapterHistory.groupBy({
      by: ["userId"],
      where: {
        lastReadAt: { gte: yesterday, lt: today },
      },
    });

    for (const { userId } of yesterdayReaders) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            username: true,
            emailNotifications: true,
          },
        });

        if (!user || !user.emailNotifications) continue;

        const allowed = await canSendEmail(user.id, "reading_streak");
        if (!allowed) continue;

        // Calculate streak
        const allHistory = await prisma.userChapterHistory.findMany({
          where: {
            userId: user.id,
            lastReadAt: { not: null },
          },
          select: { lastReadAt: true },
          orderBy: { lastReadAt: "desc" },
        });

        const readDates = new Set(
          allHistory.map((h) => {
            const d = new Date(h.lastReadAt!);
            d.setUTCHours(0, 0, 0, 0);
            return d.getTime();
          })
        );

        let streakDays = 0;
        const checkStart = new Date(yesterday);
        for (let i = 0; i < 400; i++) {
          const checkDate = new Date(
            checkStart.getTime() - i * 86400000
          );
          if (readDates.has(checkDate.getTime())) {
            streakDays++;
          } else {
            break;
          }
        }

        // Check if this is a milestone
        if (!milestones.includes(streakDays)) continue;

        // Check if we already sent this milestone
        const existingMilestone = await prisma.emailLog.findFirst({
          where: {
            userId: user.id,
            emailType: "reading_streak",
            metadata: { path: ["streakDays"], equals: streakDays },
          },
        });
        if (existingMilestone) continue;

        const unsubscribeUrl = await getUnsubscribeUrl(user.id, 'reading_streak');
        const html = templates.readingStreakTemplate(
          user.username,
          streakDays,
          unsubscribeUrl
        );

        await sendEmail({
          userId: user.id,
          to: user.email,
          subject: `Racha de ${streakDays} Dias! - Capibara Traductor`,
          html,
          emailType: "reading_streak",
          metadata: { streakDays },
        });
        sent++;
      } catch (error) {
        console.error(
          `[Email Cron] Error processing streak for user ${userId}:`,
          error
        );
      }
    }

    console.log(
      `[Email Cron] Reading streaks complete. Sent ${sent} milestone emails.`
    );
  } catch (error) {
    console.error("[Email Cron] Critical error in reading streaks:", error);
  }
}

// ──────────── Monthly Recap ────────────
// Runs on the 1st of each month at 2 PM UTC
async function processMonthlyRecap() {
  try {
    console.log("[Email Cron] Starting monthly recap...");

    const now = new Date();
    const lastMonthStart = new Date(
      now.getUTCFullYear(),
      now.getUTCMonth() - 1,
      1
    );
    const lastMonthEnd = new Date(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      1
    );
    const monthNames = [
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre",
    ];
    const monthName = monthNames[lastMonthStart.getMonth()];

    const users = await prisma.user.findMany({
      where: { emailNotifications: true },
      select: { id: true, email: true, username: true },
    });

    let sent = 0;

    for (const user of users) {
      try {
        const allowed = await canSendEmail(user.id, "monthly_recap");
        if (!allowed) continue;

        const history = await prisma.userChapterHistory.findMany({
          where: {
            userId: user.id,
            lastReadAt: { gte: lastMonthStart, lt: lastMonthEnd },
          },
          include: {
            chapter: {
              include: {
                mangaCustom: {
                  include: { genres: { select: { name: true } } },
                },
              },
            },
          },
        });

        if (history.length === 0) continue;

        const chaptersRead = history.length;
        const mangasRead = new Set(
          history.map((h) => h.chapter.mangaCustomId)
        ).size;
        const hoursEstimated = Math.round(chaptersRead * 5 / 60); // ~5 min per chapter

        // Top manga (most chapters read)
        const mangaCounts = new Map<string, number>();
        for (const h of history) {
          const title = h.chapter.mangaCustom.title;
          mangaCounts.set(title, (mangaCounts.get(title) || 0) + 1);
        }
        const topManga =
          mangaCounts.size > 0
            ? [...mangaCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
            : null;

        // Top genre
        const genreCounts = new Map<string, number>();
        for (const h of history) {
          for (const g of h.chapter.mangaCustom.genres) {
            genreCounts.set(g.name, (genreCounts.get(g.name) || 0) + 1);
          }
        }
        const topGenre =
          genreCounts.size > 0
            ? [...genreCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
            : null;

        // Favorites count
        const favoriteCount = await prisma.favorite.count({
          where: { userId: user.id },
        });

        const unsubscribeUrl = await getUnsubscribeUrl(user.id, 'monthly_recap');
        const html = templates.monthlyRecapTemplate(
          user.username,
          monthName,
          {
            chaptersRead,
            mangasRead,
            hoursEstimated,
            topManga,
            topGenre,
            favoriteCount,
          },
          unsubscribeUrl
        );

        await sendEmail({
          userId: user.id,
          to: user.email,
          subject: `Tu Mes en Numeros: ${monthName} - Capibara Traductor`,
          html,
          emailType: "monthly_recap",
          dedupWindowMinutes: 40000, // ~28 days
        });
        sent++;
      } catch (error) {
        console.error(
          `[Email Cron] Error processing monthly recap for user ${user.id}:`,
          error
        );
      }
    }

    console.log(
      `[Email Cron] Monthly recap complete. Sent to ${sent} users.`
    );
  } catch (error) {
    console.error("[Email Cron] Critical error in monthly recap:", error);
  }
}

// ──────────── Top Reader Leaderboard ────────────
// Runs Monday at 4 PM UTC
async function processTopReaderLeaderboard() {
  try {
    console.log("[Email Cron] Starting top reader leaderboard...");

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let sent = 0;

    const organizations = await prisma.organization.findMany({
      where: { isPublic: true },
      select: { id: true, name: true },
    });

    for (const org of organizations) {
      try {
        // Get org manga IDs
        const orgMangas = await prisma.mangaCustom.findMany({
          where: { organizationId: org.id },
          select: { id: true },
        });
        const orgMangaIds = orgMangas.map((m) => m.id);
        if (orgMangaIds.length === 0) continue;

        // Get top readers for this org this week
        const topReaders = await prisma.userChapterHistory.groupBy({
          by: ["userId"],
          where: {
            chapter: { mangaCustomId: { in: orgMangaIds } },
            lastReadAt: { gte: weekAgo },
          },
          _count: true,
          orderBy: { _count: { userId: "desc" } },
          take: 10,
        });

        if (topReaders.length < 3) continue; // Only if at least 3 readers

        for (let i = 0; i < Math.min(topReaders.length, 10); i++) {
          const reader = topReaders[i];
          try {
            const user = await prisma.user.findUnique({
              where: { id: reader.userId },
              select: {
                id: true,
                email: true,
                username: true,
                emailNotifications: true,
              },
            });

            if (!user || !user.emailNotifications) continue;

            const allowed = await canSendEmail(user.id, "top_reader");
            if (!allowed) continue;

            const unsubscribeUrl = await getUnsubscribeUrl(user.id, 'top_reader');
            const html = templates.topReaderTemplate(
              user.username,
              i + 1,
              org.name,
              unsubscribeUrl
            );

            await sendEmail({
              userId: user.id,
              to: user.email,
              subject: `Eres Top ${i + 1} en ${org.name}! - Capibara Traductor`,
              html,
              emailType: "top_reader",
              metadata: { organizationId: org.id, position: i + 1 },
              dedupWindowMinutes: 10000, // ~7 days
            });
            sent++;
          } catch (error) {
            console.error(
              `[Email Cron] Error sending top reader email to user ${reader.userId}:`,
              error
            );
          }
        }
      } catch (error) {
        console.error(
          `[Email Cron] Error processing top reader for org ${org.id}:`,
          error
        );
      }
    }

    console.log(
      `[Email Cron] Top reader leaderboard complete. Sent ${sent} emails.`
    );
  } catch (error) {
    console.error(
      "[Email Cron] Critical error in top reader leaderboard:",
      error
    );
  }
}

// ──────────── Reading Achievements ────────────
// Runs daily at 1 AM UTC (after streak check)
interface Achievement {
  key: string;
  title: string;
  description: string;
  emoji: string;
  check: (userId: number) => Promise<boolean>;
}

const ACHIEVEMENTS: Achievement[] = [
  {
    key: "first_chapter",
    title: "Primer Capitulo",
    description: "Leiste tu primer capitulo. Tu aventura acaba de comenzar!",
    emoji: "📖",
    check: async (userId) => {
      const count = await prisma.userChapterHistory.count({
        where: { userId, lastReadAt: { not: null } },
      });
      return count >= 1;
    },
  },
  {
    key: "chapters_50",
    title: "Lector Dedicado",
    description: "Has leido 50 capitulos. Tu dedicacion es impresionante!",
    emoji: "📚",
    check: async (userId) => {
      const count = await prisma.userChapterHistory.count({
        where: { userId, lastReadAt: { not: null } },
      });
      return count >= 50;
    },
  },
  {
    key: "chapters_100",
    title: "Centurion del Manga",
    description: "100 capitulos leidos! Eres un verdadero fan del manga!",
    emoji: "💯",
    check: async (userId) => {
      const count = await prisma.userChapterHistory.count({
        where: { userId, lastReadAt: { not: null } },
      });
      return count >= 100;
    },
  },
  {
    key: "chapters_500",
    title: "Leyenda Lectora",
    description: "500 capitulos! Pocos llegan a este nivel. Eres una leyenda!",
    emoji: "👑",
    check: async (userId) => {
      const count = await prisma.userChapterHistory.count({
        where: { userId, lastReadAt: { not: null } },
      });
      return count >= 500;
    },
  },
  {
    key: "favorites_10",
    title: "Coleccionista",
    description: "Tienes 10 mangas en tus favoritos. Tu coleccion crece!",
    emoji: "⭐",
    check: async (userId) => {
      const count = await prisma.favorite.count({ where: { userId } });
      return count >= 10;
    },
  },
  {
    key: "favorites_50",
    title: "Gran Coleccionista",
    description: "50 mangas en favoritos! Tienes un gusto exquisito!",
    emoji: "🌟",
    check: async (userId) => {
      const count = await prisma.favorite.count({ where: { userId } });
      return count >= 50;
    },
  },
  {
    key: "manga_5",
    title: "Explorador",
    description: "Has leido capitulos de 5 mangas diferentes. Sigue explorando!",
    emoji: "🧭",
    check: async (userId) => {
      const mangas = await prisma.userChapterHistory.groupBy({
        by: ["chapterId"],
        where: { userId, lastReadAt: { not: null } },
      });
      // Get unique mangaCustomIds via chapter relation
      const chapterIds = mangas.map((m) => m.chapterId);
      if (chapterIds.length === 0) return false;
      const uniqueMangas = await prisma.chapter.groupBy({
        by: ["mangaCustomId"],
        where: { id: { in: chapterIds } },
      });
      return uniqueMangas.length >= 5;
    },
  },
  {
    key: "manga_20",
    title: "Aventurero del Manga",
    description: "20 mangas diferentes! Tu diversidad lectora es admirable!",
    emoji: "🗺️",
    check: async (userId) => {
      const history = await prisma.userChapterHistory.findMany({
        where: { userId, lastReadAt: { not: null } },
        select: { chapter: { select: { mangaCustomId: true } } },
      });
      const uniqueMangas = new Set(history.map((h) => h.chapter.mangaCustomId));
      return uniqueMangas.size >= 20;
    },
  },
];

async function processReadingAchievements() {
  try {
    console.log("[Email Cron] Starting reading achievements check...");

    // Only check users who read yesterday
    const yesterday = new Date();
    yesterday.setUTCHours(0, 0, 0, 0);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const recentReaders = await prisma.userChapterHistory.groupBy({
      by: ["userId"],
      where: { lastReadAt: { gte: yesterday, lt: today } },
    });

    let sent = 0;

    for (const { userId } of recentReaders) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true, username: true, emailNotifications: true },
        });

        if (!user || !user.emailNotifications) continue;

        const allowed = await canSendEmail(user.id, "achievement");
        if (!allowed) continue;

        for (const achievement of ACHIEVEMENTS) {
          // Check if already sent
          const alreadySent = await prisma.emailLog.findFirst({
            where: {
              userId: user.id,
              emailType: "achievement",
              metadata: { path: ["achievementKey"], equals: achievement.key },
            },
          });
          if (alreadySent) continue;

          const earned = await achievement.check(user.id);
          if (!earned) continue;

          const unsubscribeUrl = await getUnsubscribeUrl(user.id, 'achievement');
          const html = templates.achievementTemplate(
            user.username,
            achievement.title,
            achievement.description,
            achievement.emoji,
            unsubscribeUrl
          );

          await sendEmail({
            userId: user.id,
            to: user.email,
            subject: `Logro Desbloqueado: ${achievement.title}! - Capibara Traductor`,
            html,
            emailType: "achievement",
            metadata: { achievementKey: achievement.key },
          });
          sent++;
        }
      } catch (error) {
        console.error(
          `[Email Cron] Error processing achievements for user ${userId}:`,
          error
        );
      }
    }

    console.log(`[Email Cron] Achievements check complete. Sent ${sent} emails.`);
  } catch (error) {
    console.error("[Email Cron] Critical error in reading achievements:", error);
  }
}

// ──────────── Register All Email Cron Jobs ────────────
export const router = () =>
  new Elysia()
    .use(
      cron({
        name: "email-daily-digest",
        pattern: "0 14 * * *", // 2 PM UTC daily
        run: processDailyDigest,
      })
    )
    .use(
      cron({
        name: "email-weekly-reading-summary",
        pattern: "0 15 * * 1", // Monday 3 PM UTC
        run: processWeeklyReadingSummary,
      })
    )
    .use(
      cron({
        name: "email-weekly-org-report",
        pattern: "5 15 * * 1", // Monday 3:05 PM UTC (offset to avoid collision)
        run: processWeeklyOrgReport,
      })
    )
    .use(
      cron({
        name: "email-re-engagement",
        pattern: "0 18 * * *", // 6 PM UTC daily
        run: processReEngagement,
      })
    )
    .use(
      cron({
        name: "email-reading-streaks",
        pattern: "0 0 * * *", // Midnight UTC daily
        run: processReadingStreaks,
      })
    )
    .use(
      cron({
        name: "email-monthly-recap",
        pattern: "0 14 1 * *", // 1st of month at 2 PM UTC
        run: processMonthlyRecap,
      })
    )
    .use(
      cron({
        name: "email-top-reader-leaderboard",
        pattern: "0 16 * * 1", // Monday 4 PM UTC
        run: processTopReaderLeaderboard,
      })
    )
    .use(
      cron({
        name: "email-reading-achievements",
        pattern: "0 1 * * *", // 1 AM UTC daily (after streak check)
        run: processReadingAchievements,
      })
    );
