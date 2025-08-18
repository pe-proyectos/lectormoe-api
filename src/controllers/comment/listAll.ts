import { prisma } from "../../models/prisma";

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
      createdAt: 'desc'
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
          createdAt: 'asc'
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
