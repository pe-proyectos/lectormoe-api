import { prisma, Prisma } from "../../models/prisma";

export const listAllComments = async (
  organizationId: number,
  userId?: number
) => {
  return await prisma.comment.findMany({
    where: {
      organizationId,
      parentId: null, // Solo comentarios principales
    },
    orderBy: {
      createdAt: Prisma.SortOrder.desc,
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          slug: true,
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
      hiddenByUser: {
        select: {
          id: true,
          username: true,
        }
      },
      likes: {
        where: {
          userId
        }
      },
      replies: {
        orderBy: {
          createdAt: Prisma.SortOrder.asc,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              slug: true,
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
          hiddenByUser: {
            select: {
              id: true,
              username: true,
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
