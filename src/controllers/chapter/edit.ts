import { prisma } from '../../models/prisma'
import type { EditChapterRequest } from '../../types/chapter/edit'
import { sanitizeBodyMarkdown } from '../../services/markdown-pipeline'

export const editChapter = async (
  organizationId: number,
  mangaSlug: string,
  chapterNumber: number,
  params: EditChapterRequest
) => {
  const r2PublicUrl =
    Bun.env.R2_PUBLIC_URL || 'https://r2.capibaratraductor.com'

  const chapterExists = await prisma.chapter.findFirst({
    where: {
      number: chapterNumber,
      deletedAt: null,
      mangaCustom: {
        manga: { slug: mangaSlug },
        organization: { id: organizationId }
      }
    },
    include: {
      pages: true
    }
  })

  if (!chapterExists) {
    throw new Error(`El capítulo ${chapterNumber} no existe`)
  }

  // Construir imageUrl desde fileKey
  const updateData: any = {
    number: params.number || chapterExists.number,
    title: params.title || chapterExists.title
  }

  if (params.volumeNumber !== undefined) {
    updateData.volumeNumber = params.volumeNumber
  }

  if (params.isUnreleased !== undefined) {
    updateData.isUnreleased = params.isUnreleased
    // Si isUnreleased es true, releasedAt debe ser null
    // Nota: Si el schema aún no permite null (migración no ejecutada),
    // simplemente no incluimos releasedAt en la actualización
    if (params.isUnreleased === true) {
      // Intentar establecer releasedAt a null
      // Si el schema lo permite, funcionará; si no, Prisma lanzará un error
      // pero podemos manejarlo omitiendo el campo
      updateData.releasedAt = null
    } else {
      // Si isUnreleased es false
      if (params.releasedAt !== undefined && params.releasedAt !== null) {
        // Si hay releasedAt en el request, usar ese valor
        updateData.releasedAt = params.releasedAt
      } else if (chapterExists.isUnreleased === true) {
        // Si se cambia de true a false y no hay releasedAt, usar fecha actual
        updateData.releasedAt = new Date()
      }
      // Si isUnreleased ya era false y no se envía releasedAt, mantener el valor existente
    }
  } else if (params?.releasedAt !== undefined && params.releasedAt !== null) {
    // Si solo se actualiza releasedAt sin cambiar isUnreleased
    // Solo actualizar si isUnreleased no es true (verificar el valor existente)
    if (!chapterExists.isUnreleased) {
      updateData.releasedAt = params.releasedAt
    }
  }

  if (params.image !== undefined) {
    if (params.image === null) {
      updateData.imageUrl = null
    } else if (typeof params.image === 'string') {
      updateData.imageUrl = params.image.startsWith('http')
        ? params.image
        : `${r2PublicUrl}/${params.image}`
    }
  }

  if (params.bodyMarkdown !== undefined) {
    updateData.bodyMarkdown =
      params.bodyMarkdown === null ? null : sanitizeBodyMarkdown(params.bodyMarkdown)
  }

  // Si isUnreleased es true y releasedAt está en updateData como null,
  // intentar la actualización. Si falla porque el schema no permite null,
  // reintentar sin incluir releasedAt
  let chapter
  try {
    chapter = await prisma.chapter.update({
      where: {
        id: chapterExists.id
      },
      data: updateData
    })
  } catch (error: any) {
    // Si el error es porque releasedAt no puede ser null, reintentar sin ese campo
    if (
      error?.message?.includes('releasedAt') &&
      error?.message?.includes('must not be null')
    ) {
      const { releasedAt, ...updateDataWithoutReleasedAt } = updateData
      chapter = await prisma.chapter.update({
        where: {
          id: chapterExists.id
        },
        data: updateDataWithoutReleasedAt
      })
    } else {
      throw error
    }
  }

  if (params.pages) {
    await prisma.page.deleteMany({
      where: {
        chapterId: chapter.id
      }
    })
    await prisma.page.createMany({
      data: params.pages.map((page, index) => {
        const pageUrl = page.startsWith('http')
          ? page
          : `${r2PublicUrl}/${page}`
        const existingPage = chapterExists.pages.find((p) => {
          if (!p.imageUrl) return false
          return p.imageUrl === pageUrl || p.imageUrl.endsWith(page)
        })
        return {
          imageUrl: pageUrl,
          number: index + 1,
          chapterId: chapter.id,
          imageHeight: existingPage?.imageHeight || 100,
          imageWidth: existingPage?.imageWidth || 100,
          imageType: existingPage?.imageType || 'any',
          isSinglePage: params.singlePages?.includes(index) ?? false
        }
      })
    })
  }

  return chapter
}
