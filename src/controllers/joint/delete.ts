import { prisma } from '../../models/prisma';
import { requireJointMember } from '../../util/joint-auth';

export const deleteJoint = async (slug: string, organizationId: number) => {
  const { joint, member } = await requireJointMember(slug, organizationId);

  if (member.role !== 'LEADER') {
    throw new Error('Solo el líder puede disolver el joint.');
  }

  const now = new Date();

  // Soft-delete all joint chapters
  await prisma.chapter.updateMany({
    where: { jointId: joint.id, deletedAt: null },
    data: { deletedAt: now },
  });

  // Soft-delete the joint
  await prisma.mangaJoint.update({
    where: { id: joint.id },
    data: { deletedAt: now },
  });

  return { success: true };
};
