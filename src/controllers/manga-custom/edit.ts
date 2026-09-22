import { prisma } from '../../models/prisma'
import type { EditMangaCustomRequest } from '../../types/manga-custom/edit'
import { sincronizarJointsDeManga } from '../../util/joint-nsfw'

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

  // No se puede marcar como one-shot si la obra tiene más de un capítulo.
  if ((params as any).isOneShot === true) {
    const chapterCount = await prisma.chapter.count({
      where: { mangaCustomId: mangaCustom.id, deletedAt: null }
    })
    if (chapterCount > 1) {
      throw new Error('No se puede marcar como one-shot: la obra tiene más de un capítulo.')
    }
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
    ...(params.chapterLabelMode !== undefined
      ? {
          chapterLabelMode: ['chapter', 'volume', 'both'].includes(String(params.chapterLabelMode))
            ? String(params.chapterLabelMode)
            : 'chapter'
        }
      : {}),
    ...(params.groupChaptersByVolume !== undefined
      ? { groupChaptersByVolume: params.groupChaptersByVolume }
      : {}),
    ...((params as any).isOneShot !== undefined
      ? { isOneShot: (params as any).isOneShot }
      : {})
  }

  // Imagen y banner. Una cadena vacia NO es una clave de archivo: si se
  // concatenaba igual salia `${r2PublicUrl}/`, o sea la URL base sin fichero,
  // que el navegador pinta como imagen rota. 119 obras acabaron asi.
  const urlDeMedia = (valor: string): string | null => {
    const limpio = valor.trim()
    if (!limpio) return null
    if (limpio.startsWith('http')) {
      // Una URL sin ruta tampoco apunta a nada.
      try {
        const u = new URL(limpio)
        if (u.pathname === '' || u.pathname === '/') return null
      } catch { return null }
      return limpio
    }
    return `${r2PublicUrl}/${limpio.replace(/^\/+/, '')}`
  }

  if (params.image !== undefined) {
    updateData.imageUrl =
      params.image === null ? null : typeof params.image === 'string' ? urlDeMedia(params.image) : undefined
  }

  if (params.banner !== undefined) {
    updateData.bannerUrl =
      params.banner === null ? null : typeof params.banner === 'string' ? urlDeMedia(params.banner) : undefined
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

  // Si cambio el +18 de la obra, los joints de ese mismo manga heredan la
  // clasificacion. Fire-and-forget: que falle no debe tumbar la edicion.
  if (params.isNSFW !== undefined && mangaCustom.mangaId) {
    void sincronizarJointsDeManga(mangaCustom.mangaId)
  }

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
