import { prisma } from "../../models/prisma";
import { getActiveDaysStreak } from "./daily-activity";

export const getUserStats = async (userId: number) => {
  // Get user to calculate account age
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  });

  if (!user) {
    throw new Error("Usuario no encontrado");
  }

  const accountAge = Math.floor(
    (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  const [toReadCount, readCount, streakDates, genreResult, weekChaptersRead, activeDaysStreak] = await Promise.all([
    // Chapters not finished (to read)
    prisma.userChapterHistory.count({
      where: { userId, finishedAt: null },
    }),

    // Chapters finished (read)
    prisma.userChapterHistory.count({
      where: { userId, finishedAt: { not: null } },
    }),

    // Distinct read dates for streak calculation
    prisma.$queryRaw<{ date: string }[]>`
      SELECT DISTINCT TO_CHAR("lastReadAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') as date
      FROM "user_chapter_history"
      WHERE "userId" = ${userId}
        AND "lastReadAt" IS NOT NULL
      ORDER BY date DESC
      LIMIT 400
    `,

    // Favorite genre
    prisma.$queryRaw<{ name: string; count: bigint }[]>`
      SELECT g.name, COUNT(*) as count
      FROM "user_chapter_history" uch
      INNER JOIN "chapter" c ON c.id = uch."chapterId"
      INNER JOIN "manga_custom" mc ON mc.id = c."mangaCustomId"
      INNER JOIN "_GenreToMangaCustom" gmc ON gmc."B" = mc.id
      INNER JOIN "genre" g ON g.id = gmc."A"
      WHERE uch."userId" = ${userId}
        AND uch."lastReadAt" IS NOT NULL
      GROUP BY g.name
      ORDER BY count DESC
      LIMIT 1
    `,

    // Chapters read this week
    (() => {
      const startOfWeek = new Date();
      startOfWeek.setUTCHours(0, 0, 0, 0);
      startOfWeek.setUTCDate(startOfWeek.getUTCDate() - startOfWeek.getUTCDay());
      return prisma.userChapterHistory.count({
        where: {
          userId,
          finishedAt: { not: null, gte: startOfWeek },
        },
      });
    })(),

    // Consecutive active days streak
    getActiveDaysStreak(userId),
  ]);

  // Calculate reading streak (consecutive days from today)
  let streak = 0;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const dateSet = new Set(streakDates.map((r) => r.date));

  for (let i = 0; i < 400; i++) {
    const checkDate = new Date(today.getTime() - i * 86400000);
    const dateStr = checkDate.toISOString().split("T")[0];
    if (dateSet.has(dateStr)) {
      streak++;
    } else if (i > 0) {
      // Allow today to be missing (user hasn't read today yet)
      break;
    }
  }

  const hoursEstimated = Math.round((readCount * 5) / 60);
  const favoriteGenre = genreResult[0]?.name || null;

  return {
    accountAge,
    activeDaysStreak,
    toRead: toReadCount,
    read: readCount,
    streak,
    favoriteGenre,
    hoursEstimated,
    weekChaptersRead,
  };
};

