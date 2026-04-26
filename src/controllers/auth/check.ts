import { prisma } from "../../models/prisma";

export const checkToken = async (
  organizationId: number | null,
  token: string
) => {
  // Always return ALL active subscriptions, regardless of org context.
  // The frontend ad-gate (calculateShowAds) needs to know if the user has
  // ANY active sub anywhere — a $1 sub to scan B should hide ads on scan A
  // too. Per-org plan benefits (canDownload, canReadUnreleased, hideAds)
  // are still scoped via subscriptionPlan.organizationId on each row.
  const includeSubscriptions = {
    subscriptions: {
      where: { active: true },
      select: {
        id: true,
        startDate: true,
        lastPayment: true,
        nextPayment: true,
        active: true,
        organizationId: true,
        subscriptionPlan: {
          select: {
            id: true,
            name: true,
            slug: true,
            interval: true,
            currency: true,
            price: true,
            organizationId: true,
            hideAds: true,
            canDownload: true,
            canReadUnreleased: true,
            active: true,
          },
        },
      },
    },
  };

  const user = await prisma.user.findFirst({
    where: {
      tokens: {
        some: {
          token,
        },
      },
    },
    include: {
      ...includeSubscriptions,
      permissions: {
        include: {
          organization: {
            select: { id: true, name: true, slug: true, logoUrl: true },
          },
        },
      },
    },
  });

  if (!user) {
    return null;
  }
  if (!user.subscriptions) {
    (user as any).subscriptions = [];
  }

  if (user) {
    user.password = "********";
    // Asegurar que subscriptions siempre esté definido
    if (!user.subscriptions) {
      (user as any).subscriptions = [];
    }
  }

  return user;
};
