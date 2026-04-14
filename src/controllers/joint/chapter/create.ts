import { prisma } from '../../../models/prisma';
import { requireJointMember, canUpload } from '../../../util/joint-auth';
import type { CreateJointChapterRequest } from '../../../types/joint/chapter/create';
import { sendNewJointChapterAlert } from '../../../services/email-notifications';

export const createJointChapter = async (
  slug: string,
  organizationId: number,
  params: CreateJointChapterRequest
) => {
  const { joint, member } = await requireJointMember(slug, organizationId);

  if (!canUpload(member)) {
    throw new Error('No tienes permisos para subir capítulos a este joint.');
  }

  // Check chapter number doesn't already exist
  const existing = await prisma.chapter.findFirst({
    where: { jointId: joint.id, number: params.number, deletedAt: null },
  });
  if (existing) throw new Error(`El capítulo ${params.number} ya existe en este joint.`);

  const r2PublicUrl = Bun.env.R2_PUBLIC_URL || 'https://r2.capibaratraductor.com';
  let imageUrl: string | null = null;
  if (params.image && typeof params.image === 'string') {
    imageUrl = params.image.startsWith('http') ? params.image : `${r2PublicUrl}/${params.image}`;
  }

  // Validate workedByOrganizationIds are all ACCEPTED members
  const acceptedMemberIds = joint.members
    .filter((m: any) => m.status === 'ACCEPTED')
    .map((m: any) => m.organizationId);

  const workedByIds = (params.workedByOrganizationIds || []).filter(id =>
    acceptedMemberIds.includes(id)
  );

  const chapter = await prisma.chapter.create({
    data: {
      jointId: joint.id,
      mangaCustomId: null,
      uploadedByOrganizationId: organizationId,
      number: params.number,
      title: params.title || '',
      imageUrl,
      releasedAt: params.isUnreleased ? null : (params.releasedAt ? new Date(params.releasedAt as any) : new Date()),
      isUnreleased: params.isUnreleased ?? false,
      workedByOrganizations: {
        connect: workedByIds.map(id => ({ id })),
      },
    },
  });

  // Create pages
  if (params.pages && params.pages.length > 0) {
    await Promise.all(
      params.pages.map(async (page, index) => {
        const pageUrl = page.startsWith('http') ? page : `${r2PublicUrl}/${page}`;
        await prisma.page.create({
          data: {
            imageUrl: pageUrl,
            number: index + 1,
            chapterId: chapter.id,
            imageHeight: 100,
            imageWidth: 100,
            imageType: 'any',
            // @ts-ignore
            isSinglePage: params.singlePages?.includes(index) ?? false,
          },
        });
      })
    );
  }

  // Update joint lastChapterAt
  await prisma.mangaJoint.update({
    where: { id: joint.id },
    data: { lastChapterAt: new Date() },
  });

  // Update lastChapterAt for all org MangaCustoms that have this manga
  const acceptedOrgIds = joint.members
    .filter((m: any) => m.status === 'ACCEPTED')
    .map((m: any) => m.organizationId);

  if (acceptedOrgIds.length > 0) {
    await prisma.mangaCustom.updateMany({
      where: {
        mangaId: joint.mangaId,
        organizationId: { in: acceptedOrgIds },
        deletedAt: null,
      },
      data: { lastChapterAt: new Date() },
    });
  }

  // Send Discord webhook notifications to all members that have it enabled
  const memberOrgs = await prisma.organization.findMany({
    where: {
      id: { in: acceptedOrgIds },
      enableDiscordWebhookNewChapter: true,
      discordWebhookUrlNewChapter: { not: null },
    },
    select: {
      name: true,
      discordWebhookUrlNewChapter: true,
      discordWebhookMessageTemplateNewChapter: true,
    },
  });

  const chapterWithData = await prisma.chapter.findFirst({
    where: { id: chapter.id },
    include: { joint: { include: { manga: { select: { title: true, slug: true } } } } },
  });

  for (const org of memberOrgs) {
    try {
      const description = org.discordWebhookMessageTemplateNewChapter
        ?.replaceAll('%manga%', chapterWithData?.joint?.title || chapterWithData?.joint?.manga?.title || joint.slug)
        .replaceAll('%chapter%', `${chapter.number}`)
        .replaceAll('%chapter_title%', chapter.title || '')
        .replaceAll('%scan%', org.name || '')
        .replaceAll('%link%', `https://capibaratraductor.com/joint/manga/${joint.slug}/chapters/${chapter.number}`);

      await fetch(org.discordWebhookUrlNewChapter!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: org.name,
          embeds: [{
            title: '📣 - Nuevo capítulo publicado (Joint)',
            description,
            color: 0x9b59b6,
            timestamp: new Date().toISOString(),
          }],
        }),
      });
    } catch (e) {
      console.error('Error enviando webhook de joint a Discord:', e);
    }
  }

  // Send email notification to users who favorited this joint or any member org's manga (fire-and-forget)
  if (!params.isUnreleased) {
    sendNewJointChapterAlert(joint.id, chapter.id).catch(console.error);
  }

  return prisma.chapter.findFirst({
    where: { id: chapter.id },
    include: {
      pages: { orderBy: { number: 'asc' } },
      uploadedByOrganization: { select: { id: true, name: true, slug: true, logoUrl: true } },
      workedByOrganizations: { select: { id: true, name: true, slug: true, logoUrl: true } },
    },
  });
};
