import { prisma } from '../../models/prisma';
import { requireJointMember } from '../../util/joint-auth';
import { recordJointMemberHistory } from '../../services/joint-history';
import type { TransferJointRequest } from '../../types/joint/transfer';

export const transferJointLeadership = async (
  slug: string,
  callerOrgId: number,
  params: TransferJointRequest,
  actorUserId?: number | null,
) => {
  const { joint, member } = await requireJointMember(slug, callerOrgId);

  if (member.role !== 'LEADER') {
    throw new Error('Solo el líder puede transferir el liderazgo.');
  }

  const targetOrg = await prisma.organization.findFirst({
    where: { slug: params.organizationSlug, isDeleted: false },
  });
  if (!targetOrg) throw new Error('Organización no encontrada.');
  if (targetOrg.id === callerOrgId) throw new Error('Ya eres el líder.');

  const targetMember = await prisma.jointMember.findUnique({
    where: { jointId_organizationId: { jointId: joint.id, organizationId: targetOrg.id } },
  });

  if (!targetMember || targetMember.status !== 'ACCEPTED') {
    throw new Error('La organización no es miembro activo del joint.');
  }

  await prisma.$transaction([
    prisma.jointMember.update({
      where: { id: member.id },
      data: { role: 'UPLOADER', canEditJoint: false, canInvite: false, canExpel: false },
    }),
    prisma.jointMember.update({
      where: { id: targetMember.id },
      data: { role: 'LEADER' },
    }),
  ]);

  await recordJointMemberHistory({
    jointId: joint.id,
    organizationId: callerOrgId,
    fromStatus: 'ACCEPTED',
    toStatus: 'ACCEPTED',
    fromRole: 'LEADER',
    toRole: 'UPLOADER',
    action: 'transfer_leadership',
    actorUserId,
  });
  await recordJointMemberHistory({
    jointId: joint.id,
    organizationId: targetOrg.id,
    fromStatus: 'ACCEPTED',
    toStatus: 'ACCEPTED',
    fromRole: targetMember.role,
    toRole: 'LEADER',
    action: 'transfer_leadership',
    actorUserId,
  });

  return { success: true };
};
