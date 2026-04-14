import { prisma } from '../../models/prisma';
import type { CreateJointRequest } from '../../types/joint/create';

const RESERVED_SLUGS = new Set(['admin', 'chapter', 'invite', 'member', 'respond', 'transfer']);

async function generateJointSlug(baseSlug: string): Promise<string> {
  const suffixes = ['', '-b', '-c', '-d', '-e', '-f'];
  for (const suffix of suffixes) {
    const slug = `${baseSlug}${suffix}`;
    if (RESERVED_SLUGS.has(slug)) continue; // skip reserved slugs
    const exists = await prisma.mangaJoint.findUnique({ where: { slug } });
    if (!exists) return slug;
  }
  throw new Error('No se pudo generar un slug único para el joint.');
}

export const createJoint = async (organizationId: number, params: CreateJointRequest) => {
  const manga = await prisma.manga.findFirst({
    where: { slug: params.mangaSlug },
  });
  if (!manga) throw new Error('No se encontró el manga base.');

  // Check manga doesn't already have an active joint
  const existingJoint = await prisma.mangaJoint.findFirst({
    where: { mangaId: manga.id, deletedAt: null },
  });
  if (existingJoint) throw new Error('Este manga ya tiene un joint activo.');

  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, isDeleted: false },
  });
  if (!organization) throw new Error('Organización no encontrada.');

  // Try to copy info from org's MangaCustom if it exists
  const existingCustom = await prisma.mangaCustom.findFirst({
    where: { mangaId: manga.id, organizationId, deletedAt: null },
  });

  const slug = await generateJointSlug(manga.slug);

  const joint = await prisma.mangaJoint.create({
    data: {
      slug,
      mangaId: manga.id,
      title: existingCustom?.title || manga.title,
      shortDescription: existingCustom?.shortDescription || manga.shortDescription || null,
      description: existingCustom?.description || manga.description || null,
      imageUrl: existingCustom?.imageUrl || manga.imageUrl || null,
      bannerUrl: existingCustom?.bannerUrl || manga.bannerUrl || null,
      status: existingCustom?.status || 'ongoing',
      workType: existingCustom?.workType || 'manga',
      members: {
        create: {
          organizationId,
          role: 'LEADER',
          status: 'ACCEPTED',
          respondedAt: new Date(),
        },
      },
    },
    include: {
      members: { include: { organization: { select: { id: true, name: true, slug: true, logoUrl: true } } } },
    },
  });

  return joint;
};
