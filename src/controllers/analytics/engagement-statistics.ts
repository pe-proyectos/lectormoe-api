import { prisma } from "../../models/prisma";

export const getEngagementStatistics = async (organizationId: number, from: Date, to: Date) => {
  const [
    activeReaders,
    totalChaptersRead,
    readingOverTime,
    topReaders,
  ] = await Promise.all([
    // Count distinct active readers in period
    prisma.$queryRaw<any[]>`
      SELECT COUNT(DISTINCT uch."userId") as count
      FROM "user_chapter_history" uch
      INNER JOIN "chapter" c ON c.id = uch."chapterId"
      INNER JOIN "manga_custom" mc ON mc.id = c."mangaCustomId"
      WHERE mc."organizationId" = ${organizationId}
        AND uch."lastReadAt" >= ${from}
        AND uch."lastReadAt" <= ${to}
    `,

    // Total chapters read in period
    prisma.$queryRaw<any[]>`
      SELECT COUNT(*) as count
      FROM "user_chapter_history" uch
      INNER JOIN "chapter" c ON c.id = uch."chapterId"
      INNER JOIN "manga_custom" mc ON mc.id = c."mangaCustomId"
      WHERE mc."organizationId" = ${organizationId}
        AND uch."lastReadAt" >= ${from}
        AND uch."lastReadAt" <= ${to}
    `,

    // Reading activity over time (daily series)
    prisma.$queryRaw<any[]>`
      SELECT
        DATE(uch."lastReadAt") as date,
        COUNT(*) as chapters,
        COUNT(DISTINCT uch."userId") as readers
      FROM "user_chapter_history" uch
      INNER JOIN "chapter" c ON c.id = uch."chapterId"
      INNER JOIN "manga_custom" mc ON mc.id = c."mangaCustomId"
      WHERE mc."organizationId" = ${organizationId}
        AND uch."lastReadAt" >= ${from}
        AND uch."lastReadAt" <= ${to}
      GROUP BY DATE(uch."lastReadAt")
      ORDER BY date ASC
    `,

    // Top 10 readers for the period
    prisma.$queryRaw<any[]>`
      SELECT
        u.id, u.username, u.slug, u."imageUrl",
        COUNT(DISTINCT uch."chapterId") as chapters_read
      FROM "user_chapter_history" uch
      INNER JOIN "chapter" c ON c.id = uch."chapterId"
      INNER JOIN "manga_custom" mc ON mc.id = c."mangaCustomId"
      INNER JOIN "user" u ON u.id = uch."userId"
      WHERE mc."organizationId" = ${organizationId}
        AND uch."lastReadAt" >= ${from}
        AND uch."lastReadAt" <= ${to}
      GROUP BY u.id, u.username, u.slug, u."imageUrl"
      ORDER BY chapters_read DESC
      LIMIT 10
    `,
  ]);

  const activeReadersCount = Number(activeReaders[0]?.count || 0);
  const totalChapters = Number(totalChaptersRead[0]?.count || 0);
  const avgChaptersPerReader = activeReadersCount > 0
    ? Math.round((totalChapters / activeReadersCount) * 10) / 10
    : 0;

  return {
    activeReaders: activeReadersCount,
    totalChaptersRead: totalChapters,
    avgChaptersPerReader,
    readingOverTime: readingOverTime.map((row: any) => ({
      date: row.date,
      chapters: Number(row.chapters),
      readers: Number(row.readers),
    })),
    topReaders: topReaders.map((reader: any) => ({
      id: reader.id,
      username: reader.username,
      slug: reader.slug,
      imageUrl: reader.imageUrl,
      chaptersRead: Number(reader.chapters_read),
    })),
  };
};
