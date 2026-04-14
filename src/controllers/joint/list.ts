import { prisma } from '../../models/prisma';

export const listJointsForOrg = async (organizationId: number) => {
  const members = await prisma.jointMember.findMany({
    where: {
      organizationId,
      status: { in: ['INVITED', 'ACCEPTED'] },
      joint: { deletedAt: null },
    },
    include: {
      joint: {
        include: {
          manga: { select: { title: true, slug: true } },
          members: {
            where: { status: 'ACCEPTED' },
            include: { organization: { select: { id: true, name: true, slug: true, logoUrl: true } } },
          },
          _count: { select: { chapters: { where: { deletedAt: null } } } },
        },
      },
    },
    orderBy: { invitedAt: 'desc' },
  });

  return members;
};
