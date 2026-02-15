import { prisma } from "../../models/prisma";

export const getGlobalTopCommenters = async () => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const topCommenters = await prisma.$queryRaw<any[]>`
    SELECT
      u.id, u.username, u.slug, u."imageUrl",
      COUNT(c.id) as comment_count
    FROM "comment" c
    INNER JOIN "user" u ON u.id = c."userId"
    WHERE c."createdAt" >= ${sevenDaysAgo}
      AND c."hiddenAt" IS NULL
      AND c."deletedAt" IS NULL
    GROUP BY u.id, u.username, u.slug, u."imageUrl"
    ORDER BY comment_count DESC
    LIMIT 10
  `;

  return topCommenters.map((c: any) => ({
    id: c.id,
    username: c.username,
    slug: c.slug,
    imageUrl: c.imageUrl,
    commentCount: Number(c.comment_count),
  }));
};
