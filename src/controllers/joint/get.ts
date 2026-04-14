import { prisma } from '../../models/prisma';

const MEMBER_SELECT = {
  id: true,
  role: true,
  status: true,
  canEditJoint: true,
  canInvite: true,
  canExpel: true,
  invitedAt: true,
  respondedAt: true,
  organization: {
    select: { id: true, name: true, slug: true, logoUrl: true, title: true },
  },
};

const CHAPTER_SELECT = {
  id: true,
  number: true,
  title: true,
  imageUrl: true,
  releasedAt: true,
  isUnreleased: true,
  views: true,
  createdAt: true,
  uploadedByOrganization: {
    select: { id: true, name: true, slug: true, logoUrl: true },
  },
  workedByOrganizations: {
    select: { id: true, name: true, slug: true, logoUrl: true },
  },
};

export const getJoint = async (slug: string) => {
  const joint = await prisma.mangaJoint.findFirst({
    where: { slug, deletedAt: null },
    include: {
      manga: {
        include: {
          demography: { select: { name: true, slug: true } },
          bookType: { select: { name: true, code: true } },
          authors: { select: { name: true, slug: true } },
        },
      },
      members: { where: { status: 'ACCEPTED' }, select: MEMBER_SELECT },
      chapters: {
        where: { deletedAt: null },
        select: CHAPTER_SELECT,
        orderBy: { number: 'desc' },
      },
    },
  });

  if (!joint) throw new Error('Joint no encontrado.');
  return joint;
};

export const getJointForAdmin = async (slug: string) => {
  // Admin view includes INVITED and EXPELLED members too
  const joint = await prisma.mangaJoint.findFirst({
    where: { slug, deletedAt: null },
    include: {
      manga: {
        include: {
          demography: { select: { name: true, slug: true } },
          bookType: { select: { name: true, code: true } },
          authors: { select: { name: true, slug: true } },
        },
      },
      members: { select: MEMBER_SELECT },
      chapters: {
        where: { deletedAt: null },
        select: CHAPTER_SELECT,
        orderBy: { number: 'desc' },
      },
    },
  });

  if (!joint) throw new Error('Joint no encontrado.');
  return joint;
};
