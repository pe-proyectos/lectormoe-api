import { prisma } from '../../models/prisma';
import { requireJointMember, canInvite } from '../../util/joint-auth';
import type { InviteToJointRequest } from '../../types/joint/invite';

export const inviteToJoint = async (
  slug: string,
  callerOrgId: number,
  params: InviteToJointRequest
) => {
  const { joint, member } = await requireJointMember(slug, callerOrgId);

  if (!canInvite(member)) {
    throw new Error('No tienes permisos para invitar a este joint.');
  }

  const targetOrg = await prisma.organization.findFirst({
    where: { slug: params.organizationSlug, isDeleted: false },
  });
  if (!targetOrg) throw new Error('Organización no encontrada.');

  // Check not already an active or pending member
  const existing = await prisma.jointMember.findUnique({
    where: { jointId_organizationId: { jointId: joint.id, organizationId: targetOrg.id } },
  });

  if (existing) {
    if (existing.status === 'ACCEPTED') throw new Error('Esta organización ya es miembro del joint.');
    if (existing.status === 'INVITED') throw new Error('Esta organización ya tiene una invitación pendiente.');
    // REJECTED or EXPELLED: re-invite by updating
    return prisma.jointMember.update({
      where: { id: existing.id },
      data: { status: 'INVITED', role: params.role, invitedAt: new Date(), respondedAt: null },
      include: { organization: { select: { id: true, name: true, slug: true, logoUrl: true } } },
    });
  }

  return prisma.jointMember.create({
    data: {
      jointId: joint.id,
      organizationId: targetOrg.id,
      role: params.role,
      status: 'INVITED',
    },
    include: { organization: { select: { id: true, name: true, slug: true, logoUrl: true } } },
  });
};
