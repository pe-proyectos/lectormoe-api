import { prisma } from "../../models/prisma";

const WRITING_BOOK_TYPE_CODES = ["novel", "light-novel", "book", "short-story"];

type ContentKind = "manga" | "writing" | "all";

export const getPerOrgPopular = async (nsfw: boolean = false, contentKind: ContentKind = "all") => {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const writingFilterForViews = contentKind === "writing"
    ? { manga: { bookType: { code: { in: WRITING_BOOK_TYPE_CODES } } } }
    : contentKind === "manga"
    ? { manga: { bookType: { code: { notIn: WRITING_BOOK_TYPE_CODES } } } }
    : {};

  // 1. Get all matching org IDs in one query
  const organizations = await prisma.organization.findMany({
    where: { isPublic: true, isNSFW: nsfw, isDeleted: false },
    select: { id: true, name: true, slug: true, logoUrl: true },
    orderBy: { name: 'asc' },
  });

  if (organizations.length === 0) return [];

  const orgIds = organizations.map((o) => o.id);

  // 2. Single groupBy across all orgs — get top view counts per mangaCustomId
  const popularViews = await prisma.viewsHistory.groupBy({
    by: ['mangaCustomId'],
    where: {
      viewedAt: { gte: oneDayAgo },
      mangaCustom: {
        organizationId: { in: orgIds },
        visibility: 'public',
        ...writingFilterForViews,
      },
    },
    _count: { ip: true },
    orderBy: { _count: { ip: 'desc' } },
    take: orgIds.length * 3, // at most 3 per org
  });

  if (popularViews.length === 0) return [];

  const mangaIds = popularViews
    .map((v) => v.mangaCustomId)
    .filter(Boolean) as number[];

  // 3. Single fetch for all mangas with their org info — filter NSFW at manga level too
  const mangas = await prisma.mangaCustom.findMany({
    where: { id: { in: mangaIds }, isNSFW: nsfw, deletedAt: null, isPublic: true, ...writingFilterForViews },
    select: {
      id: true,
      title: true,
      imageUrl: true,
      isNSFW: true,
      status: true,
      organizationId: true,
      manga: { select: { slug: true } },
      organization: { select: { id: true, name: true, slug: true, isNSFW: true } },
      chapters: {
        where: { deletedAt: null },
        select: { id: true, number: true, title: true, releasedAt: true },
        orderBy: { releasedAt: 'desc' },
        take: 2,
      },
      subscriptionPlansCanReadUnreleased: { select: { id: true } },
      subscriptionPlansCanReadReleased: { select: { id: true } },
    },
  });

  // 4. Group by org and pick top 3 per org in application code
  const viewCountMap = new Map(popularViews.map((v) => [v.mangaCustomId, v._count.ip]));
  const mangaMap = new Map(mangas.map((m) => [m.id, m]));
  const orgMap = new Map(organizations.map((o) => [o.id, o]));

  // Group mangaIds by org, sorted by view count, max 3 each
  const mangasByOrg = new Map<number, number[]>();
  for (const { mangaCustomId } of popularViews) {
    if (!mangaCustomId) continue;
    const manga = mangaMap.get(mangaCustomId);
    if (!manga) continue;
    const orgId = manga.organizationId;
    if (!orgIds.includes(orgId)) continue;
    const list = mangasByOrg.get(orgId) ?? [];
    if (list.length < 3) {
      list.push(mangaCustomId);
      mangasByOrg.set(orgId, list);
    }
  }

  const results = [];
  for (const org of organizations) {
    const ids = mangasByOrg.get(org.id);
    if (!ids || ids.length === 0) continue;

    results.push({
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        logoUrl: org.logoUrl,
      },
      mangas: ids.map((id) => {
        const m = mangaMap.get(id)!;
        return {
          id: m.id,
          title: m.title,
          imageUrl: m.imageUrl,
          isNSFW: m.isNSFW || m.organization?.isNSFW || false,
          status: m.status,
          mangaSlug: m.manga?.slug,
          organization: m.organization,
          chapters: m.chapters,
          subscriptionPlansCanReadUnreleased: m.subscriptionPlansCanReadUnreleased,
          subscriptionPlansCanReadReleased: m.subscriptionPlansCanReadReleased,
        };
      }),
    });
  }

  return results;
};
