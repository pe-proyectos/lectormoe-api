import { prisma } from '../models/prisma';

/**
 * Returns the JointMember record for the calling org in a joint.
 * Throws if joint not found, org is not an ACCEPTED member, or role check fails.
 */
export async function requireJointMember(
  jointSlug: string,
  organizationId: number,
  requiredRoles?: string[]
) {
  const joint = await prisma.mangaJoint.findFirst({
    where: { slug: jointSlug, deletedAt: null },
    include: { members: true },
  });

  if (!joint) throw new Error('Joint no encontrado.');

  const member = joint.members.find(
    m => m.organizationId === organizationId && m.status === 'ACCEPTED'
  );

  if (!member) throw new Error('Tu organización no es miembro activo de este joint.');

  if (requiredRoles && !requiredRoles.includes(member.role)) {
    throw new Error('No tienes permisos suficientes en este joint.');
  }

  return { joint, member };
}

/**
 * Check if caller can edit joint info (leader OR canEditJoint).
 */
export function canEdit(member: { role: string; canEditJoint: boolean }) {
  return member.role === 'LEADER' || member.canEditJoint;
}

/**
 * Check if caller can invite to joint (leader OR canInvite).
 */
export function canInvite(member: { role: string; canInvite: boolean }) {
  return member.role === 'LEADER' || member.canInvite;
}

/**
 * Check if caller can expel from joint (leader OR canExpel).
 */
export function canExpel(member: { role: string; canExpel: boolean }) {
  return member.role === 'LEADER' || member.canExpel;
}

/**
 * Check if caller can upload chapters (UPLOADER or LEADER).
 */
export function canUpload(member: { role: string }) {
  return member.role === 'LEADER' || member.role === 'UPLOADER';
}
