import { prisma } from "../../models/prisma";

export const checkToken = async (
  organizationId: number | null,
  token: string
) => {
  // Incluir suscripciones activas
  // Si hay organizationId, filtrar por esa organización
  // Si no hay organizationId (landing page), devolver todas las suscripciones activas
  const includeSubscriptions = {
    subscriptions: {
      where: organizationId !== null
        ? {
            active: true,
            organizationId,
          }
        : {
            active: true,
          },
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
