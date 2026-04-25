import { prisma } from '../models/prisma';
import type { JointMemberStatus, JointRole } from '../prisma-generated/client';

export interface RecordHistoryParams {
  jointId: number;
  organizationId: number;
  fromStatus?: JointMemberStatus | null;
  toStatus: JointMemberStatus;
  fromRole?: JointRole | null;
  toRole?: JointRole | null;
  action: string;
  actorUserId?: number | null;
  reason?: string | null;
}

export const recordJointMemberHistory = async (p: RecordHistoryParams) => {
  await prisma.jointMemberHistory.create({
    data: {
      jointId: p.jointId,
      organizationId: p.organizationId,
      fromStatus: p.fromStatus ?? null,
      toStatus: p.toStatus,
      fromRole: p.fromRole ?? null,
      toRole: p.toRole ?? null,
      action: p.action,
      actorUserId: p.actorUserId ?? null,
      reason: p.reason ?? null,
    },
  });
};
