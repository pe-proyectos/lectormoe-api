import { prisma, Prisma } from "../../models/prisma";

export const listComments = async (
  organizationId: number,
  identifier: string,
  admin: boolean,
  userId?: number
) => {
  return await prisma.comment.findMany({
    where: {
      organizationId,
      identifier,
      parentId: null,
      deletedAt: admin ? undefined : null,
      hiddenAt: admin ? undefined : null,
    },
    orderBy: {
      createdAt: admin ? Prisma.SortOrder.desc : Prisma.SortOrder.asc,
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          imageUrl: true,
          subscriptions: {
            where: {
              active: true,
            },
            select: {
              createdAt: true,
              subscriptionPlan: {
                select: {
                  name: true,
                }
              }
            }
          }
        }
      },
      likes: {
        where: {
          userId
        }
      },
      replies: {
        where: {
          deletedAt: admin ? undefined : null,
          hiddenAt: admin ? undefined : null,
        },
        orderBy: {
          createdAt: Prisma.SortOrder.asc,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              imageUrl: true,
                              subscriptions: {
                  where: {
                    active: true,
                  },
                  select: {
                    createdAt: true,
                    subscriptionPlan: {
                      select: {
                        name: true,
                      }
                    }
                  }
                }
            }
          },
          likes: {
            where: {
              userId
            }
          }
        }
      }
    }
  });
};
