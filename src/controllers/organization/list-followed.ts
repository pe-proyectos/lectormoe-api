import { Prisma, prisma } from '../../models/prisma'

export const listFollowedOrganizations = async (userId: number) => {
  const followedOrganizations = await prisma.organizationFollower.findMany({
    where: {
      userId
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          isNSFW: true,
          _count: {
            select: {
              followers: true
            }
          }
        }
      }
    },
    orderBy: {
      createdAt: Prisma.SortOrder.desc
    }
  })

  // Get user's active subscriptions for these organizations.
  // active=true is our source of truth. We do NOT filter by status='ACTIVE' because
  // users who cancelled PayPal recurring billing keep access until endDate (grace period).
  const now = new Date()
  const subscriptions = await prisma.subscription.findMany({
    where: {
      userId,
      active: true,
      OR: [{ endDate: null }, { endDate: { gt: now } }]
    },
    include: {
      subscriptionPlan: {
        select: {
          id: true,
          name: true,
          price: true,
          currency: true,
          interval: true,
          organizationId: true
        }
      },
      organization: {
        select: {
          id: true
        }
      }
    }
  })

  // Map subscriptions by organizationId
  const subscriptionsByOrg = subscriptions.reduce(
    (acc, sub) => {
      const orgId = sub.subscriptionPlan?.organizationId
      if (orgId != null) {
        acc[orgId] = {
          rank: sub.subscriptionPlan.name,
          price: sub.subscriptionPlan.price,
          currency: sub.subscriptionPlan.currency,
          interval: sub.subscriptionPlan.interval,
          status: sub.active ? ('active' as const) : ('paused' as const)
        }
      }
      return acc
    },
    {} as Record<
      number,
      {
        rank: string
        price: number
        currency: string
        interval: string
        status: 'active' | 'paused'
      }
    >
  )

  return followedOrganizations.map((follow) => ({
    id: follow.organization.id,
    name: follow.organization.name,
    slug: follow.organization.slug,
    logoUrl: follow.organization.logoUrl,
    isNSFW: follow.organization.isNSFW,
    subscription: subscriptionsByOrg[follow.organization.id] || null,
    followerCount: follow.organization._count.followers
  }))
}
