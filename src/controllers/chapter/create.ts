import { prisma } from '../../models/prisma'
import {
  firePublishEffects,
  resolvePublishAt
} from '../../services/chapter-schedule'
import type { CreateChapterRequest } from '../../types/chapter/create'
import { sanitizeBodyMarkdown } from '../../services/markdown-pipeline'

export const createChapter = async (
  organizationId: number,
  mangaSlug: string,
  params: CreateChapterRequest
) => {
  // Publicacion programada: fecha futura = invisible hasta esa hora; vacia o
  // pasada = publicar ya (comportamiento de siempre).
  const publishAt = resolvePublishAt(params.publishAt) ?? null

  const mangaCustom = await prisma.mangaCustom.findFirst({
    where: {
      manga: { slug: mangaSlug },
      organization: { id: organizationId }
    },
    include: {
      manga: {
        select: {
          title: true,
          slug: true
        }
      },
      organization: {
        select: {
          name: true,
          slug: true,
          enableDiscordWebhookNewChapter: true,
          discordWebhookUrlNewChapter: true,
          discordWebhookMessageTemplateNewChapter: true
        }
      }
    }
  })

  if (!mangaCustom) {
    throw new Error('No se encontró el manga')
  }

  // One-shot = un solo capítulo. Si ya tiene uno, no se permite subir más.
  if ((mangaCustom as any).isOneShot) {
    const existingCount = await prisma.chapter.count({
      where: { mangaCustomId: mangaCustom.id, deletedAt: null }
    })
    if (existingCount >= 1) {
      throw new Error('Esta obra está marcada como one-shot: solo puede tener un capítulo. Desactiva "One-shot" para subir más.')
    }
  }

  // If this org is an ACCEPTED member of an active joint for this manga,
  // chapters must be uploaded via the joint admin so they reach every member.
  // INVITED (not yet accepted) orgs are not bound and can still upload solo.
  const activeJoint = await prisma.mangaJoint.findFirst({
    where: {
      mangaId: mangaCustom.mangaId,
      deletedAt: null,
      members: { some: { organizationId, status: 'ACCEPTED' } }
    },
    select: { slug: true }
  })
  if (activeJoint) {
    throw new Error(
      `Este manga es parte del joint "${activeJoint.slug}". Sube los capítulos desde el admin del joint para que lleguen a todos los scans participantes.`
    )
  }

  const chapterExists = await prisma.chapter.findFirst({
    where: {
      number: params.number,
      mangaCustomId: mangaCustom.id,
      deletedAt: null
    }
  })

  if (chapterExists) {
    throw new Error(`El capítulo ${params.number} ya existe`)
  }

  // Clear soft-deleted siblings so the (number, mangaCustomId) unique constraint
  // doesn't block re-creating a chapter number after a delete.
  const staleDeleted = await prisma.chapter.findMany({
    where: {
      mangaCustomId: mangaCustom.id,
      number: params.number,
      deletedAt: { not: null }
    },
    select: { id: true }
  })
  if (staleDeleted.length > 0) {
    const ids = staleDeleted.map((s) => s.id)
    await prisma.page.deleteMany({ where: { chapterId: { in: ids } } })
    await prisma.userChapterHistory.deleteMany({
      where: { chapterId: { in: ids } }
    })
    await prisma.viewsHistory.deleteMany({ where: { chapterId: { in: ids } } })
    await prisma.chapter.deleteMany({ where: { id: { in: ids } } })
  }

  // Construir imageUrl desde fileKey
  let imageUrl: string | null = null
  const r2PublicUrl =
    Bun.env.R2_PUBLIC_URL || 'https://r2.capibaratraductor.com'

  if (params.image && typeof params.image === 'string') {
    imageUrl = params.image.startsWith('http')
      ? params.image
      : `${r2PublicUrl}/${params.image}`
  }

  const chapter = await prisma.chapter.create({
    data: {
      mangaCustomId: mangaCustom.id,
      number: params.number,
      title: params.title,
      releasedAt:
        params.isUnreleased === true ? null : params?.releasedAt || new Date(),
      imageUrl,
      isUnreleased: params.isUnreleased ?? false,
      publishAt,
      ...(params.volumeNumber !== undefined
        ? { volumeNumber: params.volumeNumber }
        : {}),
      ...(params.displayNumber !== undefined
        ? { displayNumber: params.displayNumber }
        : {}),
      // Text-based chapters (novels, books) carry markdown instead of pages.
      ...(params.bodyMarkdown !== undefined
        ? { bodyMarkdown: params.bodyMarkdown === null ? null : sanitizeBodyMarkdown(params.bodyMarkdown) }
        : {})
    }
  })

  if (params.pages) {
    await prisma.page.createMany({
      data: params.pages.map((page, index) => {
        const pageUrl = page.startsWith('http')
          ? page
          : `${r2PublicUrl}/${page}`
        return {
          imageUrl: pageUrl,
          number: index + 1,
          chapterId: chapter.id,
          imageHeight: 100,
          imageWidth: 100,
          imageType: 'any',
          isSinglePage: params.singlePages?.includes(index) ?? false
        }
      })
    })
  }

  // Efectos de capitulo nuevo (lastChapterAt, Discord, hilos, notificaciones,
  // milestone alerts). Si esta programado, los dispara el cron
  // chapter-scheduled-publish al llegar la hora.
  if (!publishAt) {
    await firePublishEffects(chapter.id)
  }

  return chapter
}
