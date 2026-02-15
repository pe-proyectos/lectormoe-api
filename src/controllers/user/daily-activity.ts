import { prisma } from '../../models/prisma';

/**
 * Records a daily activity entry for the user (idempotent per day).
 * Called on auth check so it fires once per session/page load.
 */
export const recordDailyActivity = async (userId: number): Promise<void> => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  await prisma.userDailyActivity.upsert({
    where: { userId_date: { userId, date: today } },
    create: { userId, date: today },
    update: {},
  });
};

/**
 * Calculates the consecutive active days streak for a user.
 * Counts backwards from today; allows today to be missing (user just started session).
 */
export const getActiveDaysStreak = async (userId: number): Promise<number> => {
  const rows = await prisma.$queryRaw<{ date: string }[]>`
    SELECT TO_CHAR("date", 'YYYY-MM-DD') as date
    FROM "user_daily_activity"
    WHERE "userId" = ${userId}
    ORDER BY "date" DESC
    LIMIT 400
  `;

  if (rows.length === 0) return 0;

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
};
