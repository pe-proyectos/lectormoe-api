import { prisma } from '../../models/prisma';
import { requireJointMember, canEdit } from '../../util/joint-auth';
import type { EditJointRequest } from '../../types/joint/edit';

export const editJoint = async (
  slug: string,
  organizationId: number,
  params: EditJointRequest
) => {
  const { joint, member } = await requireJointMember(slug, organizationId);

  if (!canEdit(member)) {
    throw new Error('No tienes permisos para editar este joint.');
  }

  const r2PublicUrl = Bun.env.R2_PUBLIC_URL || 'https://r2.capibaratraductor.com';
  const updateData: any = {
    title: params.title,
    shortDescription: params.shortDescription,
    description: params.description,
    status: params.status,
    workType: params.workType,
  };

  if (params.image !== undefined) {
    updateData.imageUrl = params.image === null
      ? null
      : params.image.startsWith('http') ? params.image : `${r2PublicUrl}/${params.image}`;
  }

  if (params.banner !== undefined) {
    updateData.bannerUrl = params.banner === null
      ? null
      : params.banner.startsWith('http') ? params.banner : `${r2PublicUrl}/${params.banner}`;
  }

  // Generos propios del joint (M2M). Si vienen genreIds, se reemplaza la lista.
  if ((params as any).genreIds !== undefined) {
    updateData.genres = {
      set: ((params as any).genreIds || []).map((id: number) => ({ id })),
    };
  }

  // Remove undefined keys so Prisma doesn't overwrite with undefined
  Object.keys(updateData).forEach(k => updateData[k] === undefined && delete updateData[k]);

  await prisma.mangaJoint.update({
    where: { id: joint.id },
    data: updateData,
  });

  return prisma.mangaJoint.findFirst({
    where: { id: joint.id },
    include: {
      members: {
        where: { status: 'ACCEPTED' },
        include: { organization: { select: { id: true, name: true, slug: true, logoUrl: true } } },
      },
      genres: { select: { id: true, name: true, category: true, nsfw: true, description: true } },
    },
  });
};
