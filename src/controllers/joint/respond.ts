import { prisma } from '../../models/prisma';
import type { RespondToJointRequest } from '../../types/joint/respond';

export const respondToJointInvite = async (
  slug: string,
  organizationId: number,
  params: RespondToJointRequest
) => {
  const joint = await prisma.mangaJoint.findFirst({
    where: { slug, deletedAt: null },
  });
  if (!joint) throw new Error('Joint no encontrado.');

  const member = await prisma.jointMember.findUnique({
    where: { jointId_organizationId: { jointId: joint.id, organizationId } },
  });

  if (!member) throw new Error('No tienes una invitación pendiente para este joint.');
  if (member.status !== 'INVITED') throw new Error('Esta invitación ya fue respondida.');

  return prisma.jointMember.update({
    where: { id: member.id },
    data: {
      status: params.accept ? 'ACCEPTED' : 'REJECTED',
      respondedAt: new Date(),
    },
    include: { organization: { select: { id: true, name: true, slug: true, logoUrl: true } } },
  });
};
