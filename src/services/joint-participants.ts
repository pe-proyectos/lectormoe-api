import { prisma } from '../models/prisma';

export interface JointParticipant {
  organizationId: number;
  isCreator: boolean;
}

/**
 * Returns every participating organization in a joint: the creator (LEADER)
 * plus all ACCEPTED members. The creator is itself a JointMember with
 * role=LEADER per createJoint(), so this just returns ACCEPTED members and
 * tags the LEADER as the creator. Duplicates are not possible because
 * (jointId, organizationId) is uniquely indexed.
 */
export async function getJointParticipants(jointId: number): Promise<JointParticipant[]> {
  const members = await prisma.jointMember.findMany({
    where: { jointId, status: 'ACCEPTED' },
    select: { organizationId: true, role: true },
  });

  return members.map(m => ({
    organizationId: m.organizationId,
    isCreator: m.role === 'LEADER',
  }));
}
