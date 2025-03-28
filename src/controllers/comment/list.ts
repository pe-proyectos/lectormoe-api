import { prisma } from "../../models/prisma";

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
      createdAt: admin ? 'desc' : 'asc'
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
  });
};
