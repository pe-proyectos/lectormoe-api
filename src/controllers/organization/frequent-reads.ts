import { prisma } from "../../models/prisma";

export const getFrequentReads = async (userId: number) => {
    // Fetch recent chapter history (last 30 days)
    const history = await prisma.userChapterHistory.findMany({
        where: {
            userId,
            updatedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
        select: {
            chapter: {
                select: {
                    mangaCustom: {
                        select: {
                            organization: {
                                select: {
                                    id: true,
                                    name: true,
                                    slug: true,
                                    logoUrl: true,
                                    isNSFW: true,
                                    isPublic: true,
                                    isDeleted: true,
                                    _count: { select: { followers: true } },
                                },
                            },
                        },
                    },
                },
            },
        },
        orderBy: { updatedAt: 'desc' },
        take: 500,
    });

    // Count chapters read per org
    const orgCounts = new Map<number, { org: any; count: number }>();
    for (const h of history) {
        const org = h.chapter?.mangaCustom?.organization;
        if (!org || !org.isPublic || org.isDeleted) continue;
        const entry = orgCounts.get(org.id) ?? { org, count: 0 };
        entry.count++;
        orgCounts.set(org.id, entry);
    }

    return [...orgCounts.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map(({ org }) => ({
            id: org.slug,
            name: org.name,
            slug: org.slug,
            logo: org.logoUrl ?? null,
            url: `/${org.slug}`,
            followerCount: org._count.followers,
            isNSFW: org.isNSFW,
        }));
};
