import { prisma } from "../../models/prisma";

export const getEmailStatistics = async (from: Date, to: Date) => {
  const [
    totalSent,
    totalFailed,
    emailsOverTime,
    typeDistribution,
  ] = await Promise.all([
    // Total emails sent successfully
    prisma.emailLog.count({
      where: {
        createdAt: { gte: from, lte: to },
        status: "sent",
      },
    }),

    // Total failed emails
    prisma.emailLog.count({
      where: {
        createdAt: { gte: from, lte: to },
        status: "failed",
      },
    }),

    // Emails over time (daily series)
    prisma.$queryRaw<any[]>`
      SELECT
        DATE("createdAt") as date,
        COUNT(*) FILTER (WHERE status = 'sent') as sent,
        COUNT(*) FILTER (WHERE status = 'failed') as failed
      FROM "email_log"
      WHERE "createdAt" >= ${from}
        AND "createdAt" <= ${to}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `,

    // Distribution by email type
    prisma.$queryRaw<any[]>`
      SELECT "emailType" as type, COUNT(*) as count
      FROM "email_log"
      WHERE "createdAt" >= ${from}
        AND "createdAt" <= ${to}
      GROUP BY "emailType"
      ORDER BY count DESC
    `,
  ]);

  const total = totalSent + totalFailed;
  const deliveryRate = total > 0 ? Math.round((totalSent / total) * 100) : 100;

  return {
    totalSent,
    totalFailed,
    deliveryRate,
    emailsOverTime: emailsOverTime.map((row: any) => ({
      date: row.date,
      sent: Number(row.sent),
      failed: Number(row.failed),
    })),
    typeDistribution: typeDistribution.map((row: any) => ({
      id: row.type,
      label: row.type.replace(/_/g, ' '),
      value: Number(row.count),
    })),
  };
};
