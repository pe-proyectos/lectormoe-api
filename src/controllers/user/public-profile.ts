import { prisma, Prisma } from '../../models/prisma';
import { getUserStats } from './stats';
import { getUserAchievements, getCommentRank } from './achievements';

export const getPublicProfile = async (slug: string) => {
  const user = await prisma.user.findUnique({
    where: { slug },
    select: {
      id: true,
      username: true,
      slug: true,
      imageUrl: true,
      bannerUrl: true,
      description: true,
      createdAt: true,
      subscriptions: {
        where: { active: true },
        select: {
          active: true,
          subscriptionPlan: {
            select: {
              id: true,
              name: true,
              price: true,
              organizationId: true,
            },
          },
        },
      },
    },
  });

  if (!user) return null;

  const [stats, achievements, commentRank] = await Promise.all([
    getUserStats(user.id),
    getUserAchievements(user.id),
    getCommentRank(user.id),
  ]);

  return {
    ...user,
    stats,
    achievements,
    commentRank,
  };
};

export const getPublicFavorites = async (slug: string, limit: number = 12) => {
  const user = await prisma.user.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (!user) return null;

  const favorites = await prisma.favorite.findMany({
    where: { userId: user.id },
    include: {
      mangaCustom: {
        select: {
          id: true,
          title: true,
          imageUrl: true,
          status: true,
          isNSFW: true,
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              isNSFW: true,
            },
          },
          manga: {
            select: {
              slug: true,
            },
          },
          chapters: {
            select: {
              id: true,
              number: true,
              title: true,
              releasedAt: true,
            },
            orderBy: {
              releasedAt: Prisma.SortOrder.desc,
            },
            take: 2,
          },
        },
      },
    },
    orderBy: {
      createdAt: Prisma.SortOrder.desc,
    },
    take: limit,
  });

  return favorites;
};

export const getPublicFollowedScans = async (slug: string) => {
  const user = await prisma.user.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (!user) return null;

  const followedOrgs = await prisma.organizationFollower.findMany({
    where: { userId: user.id },
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
              followers: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: Prisma.SortOrder.desc,
    },
  });

  return followedOrgs.map((follow) => ({
    id: follow.organization.id,
    name: follow.organization.name,
    slug: follow.organization.slug,
    logoUrl: follow.organization.logoUrl,
    isNSFW: follow.organization.isNSFW,
    followerCount: follow.organization._count.followers,
  }));
};
