import { prisma } from "../../models/prisma";

export const getPerOrgPopular = async () => {
  // Get all public, non-NSFW organizations
  const organizations = await prisma.organization.findMany({
    where: { isPublic: true, isNSFW: false, isDeleted: false },
    select: { id: true, name: true, slug: true, logoUrl: true },
    orderBy: { name: 'asc' },
  });

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const results = [];

  for (const org of organizations) {
    // Get top 3 popular manga for this org (by views in last 24h)
    const popularViews = await prisma.viewsHistory.groupBy({
      by: ['mangaCustomId'],
      where: {
        viewedAt: { gte: oneDayAgo },
        mangaCustom: { organizationId: org.id, visibility: 'public' },
      },
      _count: { ip: true },
      orderBy: { _count: { ip: 'desc' } },
      take: 3,
    });

    if (popularViews.length === 0) continue;

    const mangaIds = popularViews
      .map((v) => v.mangaCustomId)
      .filter(Boolean) as number[];

    const mangas = await prisma.mangaCustom.findMany({
      where: { id: { in: mangaIds } },
      select: {
        id: true,
        title: true,
        imageUrl: true,
        isNSFW: true,
        status: true,
        manga: { select: { slug: true } },
        organization: { select: { id: true, name: true, slug: true, isNSFW: true } },
        chapters: {
          select: {
            id: true,
            number: true,
            title: true,
            releasedAt: true,
          },
          orderBy: { releasedAt: 'desc' },
          take: 2,
        },
        subscriptionPlansCanReadUnreleased: { select: { id: true } },
        subscriptionPlansCanReadReleased: { select: { id: true } },
      },
    });

    // Sort mangas in the same order as popularViews
    const viewsMap = new Map(popularViews.map((v, i) => [v.mangaCustomId, i]));
    mangas.sort((a, b) => (viewsMap.get(a.id) ?? 99) - (viewsMap.get(b.id) ?? 99));

    results.push({
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        logoUrl: org.logoUrl,
      },
      mangas: mangas.map((m) => ({
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
      })),
    });
  }

  return results;
};
