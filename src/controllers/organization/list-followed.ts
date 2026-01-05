import { prisma } from "../../models/prisma";

export const listFollowedOrganizations = async (userId: number) => {
    const followedOrganizations = await prisma.organizationFollower.findMany({
        where: {
            userId,
        },
        include: {
            organization: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    logoUrl: true,
                    _count: {
                        select: {
                            followers: true,
                        },
                    },
                },
            },
        },
        orderBy: {
            createdAt: 'desc',
        },
    });

    // Get user's active subscriptions for these organizations
    const subscriptions = await prisma.subscription.findMany({
        where: {
            userId,
            active: true,
            status: 'ACTIVE',
        },
        include: {
            subscriptionPlan: {
                select: {
                    id: true,
                    name: true,
                    price: true,
                    currency: true,
                },
            },
            organization: {
                select: {
                    id: true,
                },
            },
        },
    });

    // Map subscriptions by organizationId
    const subscriptionsByOrg = subscriptions.reduce((acc, sub) => {
        if (sub.organizationId !== null) {
            acc[sub.organizationId] = {
                rank: sub.subscriptionPlan.name,
                price: sub.subscriptionPlan.price,
                currency: sub.subscriptionPlan.currency,
                status: sub.active && sub.status === 'ACTIVE' ? 'active' as const : 'paused' as const,
            };
        }
        return acc;
    }, {} as Record<number, { rank: string; price: number; currency: string; status: 'active' | 'paused' }>);

    return followedOrganizations.map((follow) => ({
        id: follow.organization.id,
        name: follow.organization.name,
        slug: follow.organization.slug,
        logoUrl: follow.organization.logoUrl,
        subscription: subscriptionsByOrg[follow.organization.id] || null,
        followerCount: follow.organization._count.followers,
    }));
};

