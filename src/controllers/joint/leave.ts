import { prisma } from '../../models/prisma';
import { requireJointMember } from '../../util/joint-auth';
import { detachOrgFromJoint } from '../../services/joint-detach';
import { recordJointMemberHistory } from '../../services/joint-history';
import { dissolveJoint } from './delete';

export const leaveJoint = async (
  slug: string,
  organizationId: number,
  actorUserId?: number | null,
) => {
  const { joint, member } = await requireJointMember(slug, organizationId);

  // Get all ACCEPTED members to decide auto-promote / auto-dissolve.
  const accepted = await prisma.jointMember.findMany({
    where: { jointId: joint.id, status: 'ACCEPTED' },
    orderBy: { invitedAt: 'asc' },
    select: { id: true, organizationId: true, role: true, invitedAt: true },
  });

  const others = accepted.filter(m => m.organizationId !== organizationId);

  if (member.role === 'LEADER' && others.length === 0) {
    throw new Error("Eres el único miembro. Usa 'Eliminar joint' en su lugar.");
  }

  // Auto-promote the oldest other ACCEPTED member to LEADER if leader is leaving.
  let autoPromotedOrgId: number | null = null;
  if (member.role === 'LEADER') {
    const successor = others[0];
    autoPromotedOrgId = successor.organizationId;
    await prisma.$transaction([
      prisma.jointMember.update({
        where: { id: member.id },
        data: { role: 'UPLOADER', canEditJoint: false, canInvite: false, canExpel: false },
      }),
      prisma.jointMember.update({
        where: { id: successor.id },
        data: { role: 'LEADER' },
      }),
    ]);
    await recordJointMemberHistory({
      jointId: joint.id,
      organizationId: successor.organizationId,
      fromStatus: 'ACCEPTED',
      toStatus: 'ACCEPTED',
      fromRole: successor.role,
      toRole: 'LEADER',
      action: 'auto_promote',
      actorUserId,
      reason: 'leader_left',
    });
  }

  const detach = await detachOrgFromJoint(joint.id, organizationId, { actorUserId, reason: 'leave' });

  await prisma.jointMember.update({
    where: { id: member.id },
    data: { status: 'LEFT' },
  });

  await recordJointMemberHistory({
    jointId: joint.id,
    organizationId,
    fromStatus: 'ACCEPTED',
    toStatus: 'LEFT',
    fromRole: member.role,
    toRole: member.role === 'LEADER' ? 'UPLOADER' : member.role,
    action: 'leave',
    actorUserId,
  });

  // After leaving, if no ACCEPTED members remain → auto-dissolve.
  const remaining = await prisma.jointMember.count({
    where: { jointId: joint.id, status: 'ACCEPTED' },
  });

  let autoDissolved = false;
  if (remaining === 0) {
    await dissolveJoint(joint.id, { actorUserId, triggeredByLeader: false, reason: 'last_member_left' });
    autoDissolved = true;
  }

  return {
    moved: detach.moved,
    conflicts: detach.conflicts,
    autoDissolved,
    autoPromotedOrgId,
  };
};
