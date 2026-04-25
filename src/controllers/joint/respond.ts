import { prisma } from '../../models/prisma';
import { recordJointMemberHistory } from '../../services/joint-history';
import type { RespondToJointRequest } from '../../types/joint/respond';

export const respondToJointInvite = async (
  slug: string,
  organizationId: number,
  params: RespondToJointRequest,
  actorUserId?: number | null,
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

  const newStatus = params.accept ? 'ACCEPTED' : 'REJECTED';

  const updated = await prisma.jointMember.update({
    where: { id: member.id },
    data: {
      status: newStatus,
      respondedAt: new Date(),
    },
    include: { organization: { select: { id: true, name: true, slug: true, logoUrl: true } } },
  });

  await recordJointMemberHistory({
    jointId: joint.id,
    organizationId,
    fromStatus: 'INVITED',
    toStatus: newStatus,
    fromRole: member.role,
    toRole: member.role,
    action: params.accept ? 'accept' : 'reject',
    actorUserId,
  });

  return updated;
};
