import { prisma } from '../../models/prisma';
import { requireJointMember } from '../../util/joint-auth';
import type { UpdateJointMemberPermissionsRequest } from '../../types/joint/permissions';

export const updateJointMemberPermissions = async (
  slug: string,
  callerOrgId: number,
  targetOrgSlug: string,
  params: UpdateJointMemberPermissionsRequest
) => {
  const { joint, member } = await requireJointMember(slug, callerOrgId);

  if (member.role !== 'LEADER') {
    throw new Error('Solo el líder puede modificar permisos de los miembros.');
  }

  const targetOrg = await prisma.organization.findFirst({
    where: { slug: targetOrgSlug, isDeleted: false },
  });
  if (!targetOrg) throw new Error('Organización no encontrada.');
  if (targetOrg.id === callerOrgId) throw new Error('No puedes modificar tus propios permisos.');

  const targetMember = await prisma.jointMember.findUnique({
    where: { jointId_organizationId: { jointId: joint.id, organizationId: targetOrg.id } },
  });

  if (!targetMember || targetMember.status !== 'ACCEPTED') {
    throw new Error('La organización no es miembro activo del joint.');
  }

  if (targetMember.role === 'LEADER') {
    throw new Error('No puedes modificar permisos del líder.');
  }

  const updateData: any = {};
  if (params.canEditJoint !== undefined) updateData.canEditJoint = params.canEditJoint;
  if (params.canInvite !== undefined) updateData.canInvite = params.canInvite;
  if (params.canExpel !== undefined) updateData.canExpel = params.canExpel;
  if (params.role !== undefined && params.role !== 'LEADER') updateData.role = params.role;

  return prisma.jointMember.update({
    where: { id: targetMember.id },
    data: updateData,
    include: { organization: { select: { id: true, name: true, slug: true, logoUrl: true } } },
  });
};
