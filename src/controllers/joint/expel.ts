import { prisma } from '../../models/prisma';
import { requireJointMember, canExpel } from '../../util/joint-auth';

export const expelFromJoint = async (
  slug: string,
  callerOrgId: number,
  targetOrgSlug: string
) => {
  const { joint, member } = await requireJointMember(slug, callerOrgId);

  if (!canExpel(member)) {
    throw new Error('No tienes permisos para expulsar miembros de este joint.');
  }

  const targetOrg = await prisma.organization.findFirst({
    where: { slug: targetOrgSlug, isDeleted: false },
  });
  if (!targetOrg) throw new Error('Organización no encontrada.');

  if (targetOrg.id === callerOrgId) {
    throw new Error('No puedes expulsarte a ti mismo. Si eres el líder, transfiere el liderazgo primero.');
  }

  const targetMember = await prisma.jointMember.findUnique({
    where: { jointId_organizationId: { jointId: joint.id, organizationId: targetOrg.id } },
  });

  if (!targetMember || targetMember.status !== 'ACCEPTED') {
    throw new Error('La organización no es miembro activo del joint.');
  }

  if (targetMember.role === 'LEADER') {
    throw new Error('No puedes expulsar al líder. Primero transfiere el liderazgo.');
  }

  return prisma.jointMember.update({
    where: { id: targetMember.id },
    data: { status: 'EXPELLED' },
  });
};
