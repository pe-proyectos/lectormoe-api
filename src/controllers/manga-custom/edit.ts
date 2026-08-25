import { prisma } from '../../models/prisma'
import type { EditMangaCustomRequest } from '../../types/manga-custom/edit'

export const editMangaCustom = async (
  organizationId: number,
  mangaSlug: string,
  params: EditMangaCustomRequest
) => {
  const mangaCustom = await prisma.mangaCustom.findFirst({
    where: {
      id: params.mangaCustomId,
      organizationId,
      deletedAt: null,
      manga: {
        slug: mangaSlug
      }
    }
  })

  if (!mangaCustom) {
    throw new Error('Tu organización no tiene este manga')
  }

  // Construir URLs desde fileKeys
  const r2PublicUrl =
    Bun.env.R2_PUBLIC_URL || 'https://r2.capibaratraductor.com'
  const updateData: any = {
    status: params.status,
    title: params.title,
    ...(params.alternativeTitle !== undefined
      ? { alternativeTitle: params.alternativeTitle?.trim() || null }
      : {}),
    shortDescription: params.shortDescription,
    description: params.description,
    releasedAt: params.releasedAt,
    nextChapterAt: params.nextChapterAt,
    nextChapterAtMessage: params.nextChapterAtMessage,
    requireLogin: params.requireLogin,
    isSimulRelease: params.isSimulRelease,
    isNSFW: params.isNSFW,
    ...((params as any).isPublic !== undefined
      ? { isPublic: (params as any).isPublic }
      : {}),
    workType: params.workType,
    ...(params.hideUnreleasedChapters !== undefined
      ? { hideUnreleasedChapters: params.hideUnreleasedChapters }
      : {}),
    ...(params.finalChapterNumber !== undefined
      ? { finalChapterNumber: params.finalChapterNumber }
      : {}),
    ...(params.groupChaptersByVolume !== undefined
      ? { groupChaptersByVolume: params.groupChaptersByVolume }
      : {}),
    ...((params as any).isOneShot !== undefined
      ? { isOneShot: (params as any).isOneShot }
      : {})
  }

  // Manejar image
  if (params.image !== undefined) {
    if (params.image === null) {
      updateData.imageUrl = null
    } else if (typeof params.image === 'string') {
      updateData.imageUrl = params.image.startsWith('http')
        ? params.image
        : `${r2PublicUrl}/${params.image}`
    }
  }

  // Manejar banner
  if (params.banner !== undefined) {
    if (params.banner === null) {
      updateData.bannerUrl = null
    } else if (typeof params.banner === 'string') {
      updateData.bannerUrl = params.banner.startsWith('http')
        ? params.banner
        : `${r2PublicUrl}/${params.banner}`
    }
  }

  await prisma.mangaCustom.update({
    where: {
      id: mangaCustom.id
    },
    data: updateData
  })

  // Demografía: vive en el Manga base (compartido). Si viene demographyId (o null
  // para quitarla), se actualiza el Manga de esta obra.
  if ((params as any).demographyId !== undefined) {
    await prisma.manga.update({
      where: { id: mangaCustom.mangaId },
      data: { demographyId: (params as any).demographyId }
    })
  }

  await prisma.mangaCustom.update({
    where: {
      id: mangaCustom.id
    },
    data: {
      genres: {
        set:
          params?.genreIds?.map((genreId) => ({
            id: genreId
          })) || []
      },
      subscriptionPlansCanReadUnreleased: {
        set:
          params?.subscriptionPlanIdsCanReadUnreleased?.map(
            (subscriptionPlanId) => ({
              id: subscriptionPlanId
            })
          ) || []
      },
      subscriptionPlansCanReadReleased: {
        set:
          params?.subscriptionPlanIdsCanReadReleased?.map(
            (subscriptionPlanId) => ({
              id: subscriptionPlanId
            })
          ) || []
      }
    }
  })

  return await prisma.mangaCustom.findFirst({
    where: { id: mangaCustom.id },
    include: {
      manga: {
        include: {
          authors: true,
          demography: true,
          bookType: true
        }
      },
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          isNSFW: true
        }
      },
      genres: true,
      subscriptionPlansCanReadUnreleased: true,
      subscriptionPlansCanReadReleased: true
    }
  })
}
