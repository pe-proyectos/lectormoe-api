import { prisma } from '../../models/prisma';
import { requireJointMember } from '../../util/joint-auth';
import { detachOrgFromJoint } from '../../services/joint-detach';
import { recordJointMemberHistory } from '../../services/joint-history';

export const deleteJoint = async (
  slug: string,
  organizationId: number,
  actorUserId?: number | null,
) => {
  const { joint, member } = await requireJointMember(slug, organizationId);

  if (member.role !== 'LEADER') {
    throw new Error('Solo el líder puede disolver el joint.');
  }

  return dissolveJoint(joint.id, { actorUserId, triggeredByLeader: true });
};

// Internal helper: detach every ACCEPTED member's chapters back to their MC,
// then soft-delete the joint. Reused from leaveJoint when the last member walks.
export const dissolveJoint = async (
  jointId: number,
  opts: { actorUserId?: number | null; triggeredByLeader: boolean; reason?: string },
) => {
  const acceptedMembers = await prisma.jointMember.findMany({
    where: { jointId, status: 'ACCEPTED' },
    select: { id: true, organizationId: true, role: true },
  });

  const detachResults: Array<{ organizationId: number; moved: number; conflicts: number }> = [];

  for (const m of acceptedMembers) {
    const result = await detachOrgFromJoint(jointId, m.organizationId, {
      actorUserId: opts.actorUserId ?? null,
      reason: opts.triggeredByLeader ? 'delete' : 'auto_dissolve',
    });
    detachResults.push({ organizationId: m.organizationId, moved: result.moved, conflicts: result.conflicts });

    await recordJointMemberHistory({
      jointId,
      organizationId: m.organizationId,
      fromStatus: 'ACCEPTED',
      toStatus: 'LEFT',
      fromRole: m.role,
      toRole: m.role,
      action: opts.triggeredByLeader ? 'auto_dissolve' : 'auto_dissolve',
      actorUserId: opts.actorUserId ?? null,
      reason: opts.reason ?? null,
    });
  }

  // Fallback for legacy chapters with uploadedByOrganizationId = NULL: they
  // didn't match any member's detach pass and would be orphaned under a
  // soft-deleted joint. Attribute them to the LEADER (or the oldest ACCEPTED
  // member if no LEADER) and move to that org's MangaCustom. Skip if no
  // members exist at all.
  const orphanCount = await prisma.chapter.count({
    where: { jointId, uploadedByOrganizationId: null, deletedAt: null },
  });
  if (orphanCount > 0 && acceptedMembers.length > 0) {
    const leader = acceptedMembers.find((m) => m.role === 'LEADER') ?? acceptedMembers[0];
    const orphanResult = await detachOrgFromJoint(jointId, leader.organizationId, {
      actorUserId: opts.actorUserId ?? null,
      reason: 'orphan_fallback',
      uploaderFilter: 'null', // see joint-detach.ts
    });
    detachResults.push({ organizationId: leader.organizationId, moved: orphanResult.moved, conflicts: orphanResult.conflicts });
  }

  await prisma.jointMember.updateMany({
    where: { jointId, status: 'ACCEPTED' },
    data: { status: 'LEFT' },
  });

  await prisma.mangaJoint.update({
    where: { id: jointId },
    data: { deletedAt: new Date() },
  });

  await prisma.audit.create({
    data: {
      action: opts.triggeredByLeader ? 'joint_delete' : 'joint_auto_dissolve',
      payload: { jointId, detachResults, reason: opts.reason ?? null },
      ip: 'system',
      userId: opts.actorUserId ?? null,
    },
  });

  return { success: true, detachResults };
};
