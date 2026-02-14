import { prisma } from "../../models/prisma";

export const getTopReaders = async (organizationId: number) => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const topReaders = await prisma.$queryRaw<any[]>`
    SELECT
      u.id, u.username, u.slug, u."imageUrl",
      COUNT(DISTINCT uch."chapterId") as chapters_read
    FROM "user_chapter_history" uch
    INNER JOIN "chapter" c ON c.id = uch."chapterId"
    INNER JOIN "manga_custom" mc ON mc.id = c."mangaCustomId"
    INNER JOIN "user" u ON u.id = uch."userId"
    WHERE mc."organizationId" = ${organizationId}
      AND uch."lastReadAt" IS NOT NULL
      AND uch."lastReadAt" >= ${sevenDaysAgo}
    GROUP BY u.id, u.username, u.slug, u."imageUrl"
    ORDER BY chapters_read DESC
    LIMIT 10
  `;

  return topReaders.map((reader: any) => ({
    id: reader.id,
    username: reader.username,
    slug: reader.slug,
    imageUrl: reader.imageUrl,
    chaptersRead: Number(reader.chapters_read),
  }));
};
