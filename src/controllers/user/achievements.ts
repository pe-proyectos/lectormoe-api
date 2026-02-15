import { prisma } from '../../models/prisma';

/**
 * Get all achievements with user's unlock status.
 */
export const getUserAchievements = async (userId: number) => {
  const [achievements, userAchievements] = await Promise.all([
    prisma.achievement.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.userAchievement.findMany({
      where: { userId },
      select: { achievementId: true, unlockedAt: true },
    }),
  ]);

  const unlockedMap = new Map(
    userAchievements.map((ua) => [ua.achievementId, ua.unlockedAt])
  );

  return achievements.map((a) => ({
    id: a.id,
    key: a.key,
    title: a.title,
    description: a.description,
    emoji: a.emoji,
    category: a.category,
    sortOrder: a.sortOrder,
    unlocked: unlockedMap.has(a.id),
    unlockedAt: unlockedMap.get(a.id) || null,
  }));
};

/**
 * Check and unlock achievements for a user. Returns newly unlocked achievements.
 * Called after chapter read, comment creation, favorite, follow, etc.
 */
export const checkAndUnlockAchievements = async (
  userId: number,
  context?: { action?: string; hour?: number }
): Promise<{ key: string; title: string; emoji: string; description: string }[]> => {
  // Get all achievements and user's already-unlocked ones
  const [allAchievements, alreadyUnlocked] = await Promise.all([
    prisma.achievement.findMany(),
    prisma.userAchievement.findMany({
      where: { userId },
      select: { achievementId: true },
    }),
  ]);

  const unlockedIds = new Set(alreadyUnlocked.map((ua) => ua.achievementId));
  const locked = allAchievements.filter((a) => !unlockedIds.has(a.id));

  if (locked.length === 0) return [];

  // Gather user stats (batched for performance)
  const [chaptersRead, mangasRead, favCount, commentsCount, followCount, streakDays] = await Promise.all([
    prisma.userChapterHistory.count({ where: { userId, lastReadAt: { not: null } } }),
    prisma.userChapterHistory.findMany({
      where: { userId, lastReadAt: { not: null } },
      select: { chapter: { select: { mangaCustomId: true } } },
    }).then((rows) => new Set(rows.map((r) => r.chapter.mangaCustomId)).size),
    prisma.favorite.count({ where: { userId } }),
    prisma.comment.count({ where: { userId } }),
    prisma.organizationFollower.count({ where: { userId } }),
    // Reading streak
    prisma.$queryRaw<{ date: string }[]>`
      SELECT DISTINCT TO_CHAR("lastReadAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') as date
      FROM "user_chapter_history"
      WHERE "userId" = ${userId} AND "lastReadAt" IS NOT NULL
      ORDER BY date DESC
      LIMIT 400
    `.then((rows) => {
      const dateSet = new Set(rows.map((r) => r.date));
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      let streak = 0;
      for (let i = 0; i < 400; i++) {
        const checkDate = new Date(today.getTime() - i * 86400000);
        const dateStr = checkDate.toISOString().split('T')[0];
        if (dateSet.has(dateStr)) {
          streak++;
        } else if (i > 0) {
          break;
        }
      }
      return streak;
    }),
  ]);

  // Check conditions for each locked achievement
  const thresholds: Record<string, boolean> = {
    // Reading milestones
    first_chapter: chaptersRead >= 1,
    chapters_10: chaptersRead >= 10,
    chapters_25: chaptersRead >= 25,
    chapters_50: chaptersRead >= 50,
    chapters_100: chaptersRead >= 100,
    chapters_250: chaptersRead >= 250,
    chapters_500: chaptersRead >= 500,
    chapters_1000: chaptersRead >= 1000,
    // Manga diversity
    manga_3: mangasRead >= 3,
    manga_5: mangasRead >= 5,
    manga_10: mangasRead >= 10,
    manga_20: mangasRead >= 20,
    manga_50: mangasRead >= 50,
    // Favorites
    favorites_5: favCount >= 5,
    favorites_10: favCount >= 10,
    favorites_25: favCount >= 25,
    favorites_50: favCount >= 50,
    // Streak
    streak_3: streakDays >= 3,
    streak_7: streakDays >= 7,
    streak_14: streakDays >= 14,
    streak_30: streakDays >= 30,
    streak_100: streakDays >= 100,
    streak_365: streakDays >= 365,
    // Community
    first_comment: commentsCount >= 1,
    comments_10: commentsCount >= 10,
    comments_50: commentsCount >= 50,
    comments_100: commentsCount >= 100,
    follow_org: followCount >= 1,
    follow_5_orgs: followCount >= 5,
    // Special
    night_owl: context?.hour !== undefined ? (context.hour >= 2 && context.hour < 5) : false,
  };

  const newlyUnlocked: { key: string; title: string; emoji: string; description: string }[] = [];

  for (const achievement of locked) {
    const earned = thresholds[achievement.key];
    if (!earned) continue;

    try {
      await prisma.userAchievement.create({
        data: { userId, achievementId: achievement.id },
      });
      newlyUnlocked.push({
        key: achievement.key,
        title: achievement.title,
        emoji: achievement.emoji,
        description: achievement.description,
      });
    } catch {
      // Unique constraint - already unlocked (race condition safe)
    }
  }

  return newlyUnlocked;
};

/**
 * Get achievement count for a user (for profile stats).
 */
export const getAchievementCount = async (userId: number) => {
  const [total, unlocked] = await Promise.all([
    prisma.achievement.count(),
    prisma.userAchievement.count({ where: { userId } }),
  ]);
  return { total, unlocked };
};

/**
 * Get user's comment rank and count (global ranking).
 */
export const getCommentRank = async (userId: number) => {
  const userCommentCount = await prisma.comment.count({ where: { userId } });
  if (userCommentCount === 0) return null;

  // Count users with more comments than this user
  const usersWithMoreComments = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM (
      SELECT "userId"
      FROM "comment"
      GROUP BY "userId"
      HAVING COUNT(*) > ${userCommentCount}
    ) subquery
  `;

  const rank = Number(usersWithMoreComments[0]?.count || 0) + 1;

  return { rank, count: userCommentCount };
};
