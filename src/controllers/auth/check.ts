import { prisma } from "../../models/prisma";

export const checkToken = async (
  organizationId: number | null,
  token: string
) => {
  // Primero encontrar el usuario por token (sin filtrar por organización)
  const includeSubscriptions =
    organizationId !== null
      ? {
          subscriptions: {
            where: {
              active: true,
              organizationId,
            },
            select: {
              id: true,
              startDate: true,
              lastPayment: true,
              nextPayment: true,
              subscriptionPlan: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  interval: true,
                  currency: true,
                  hideAds: true,
                  canDownload: true,
                  canReadUnreleased: true,
                  active: true,
                },
              },
            },
          },
        }
      : {};

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
      permissions: true,
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
