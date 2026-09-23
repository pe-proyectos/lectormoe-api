import { prisma } from '../../models/prisma'
import { limitesDeUsuario } from '../../util/capibara-plans'

export const saveFavorite = async (
  organizationId: number | null,
  userId: number,
  mangaSlug: string
) => {
  const whereClause: any = {
    manga: { slug: mangaSlug }
  }

  if (organizationId !== null) {
    whereClause.organizationId = organizationId
  }

  const manga = await prisma.mangaCustom.findFirst({
    select: { id: true },
    where: whereClause
  })

  if (!manga) {
    return false
  }

  const existingFavorite = await prisma.favorite.findFirst({
    where: { userId, mangaCustomId: manga.id }
  })

  if (existingFavorite) {
    return true
  }

  // El tope depende del nivel del usuario (ver util/capibara-plans). Solo se
  // comprueba al AÑADIR: quien ya lo supera conserva todo y puede quitar.
  const { favoritos } = await limitesDeUsuario(userId)
  if (favoritos !== null) {
    const currentCount = await prisma.favorite.count({ where: { userId } })
    if (currentCount >= favoritos) {
      throw new Error(`Has alcanzado el límite de ${favoritos} favoritos. Mejora tu plan para guardar más.`)
    }
  }

  // New favorites append at the end of the user's order.
  const maxOrder = await prisma.favorite.aggregate({
    where: { userId },
    _max: { order: true }
  })
  await prisma.favorite.create({
    data: {
      userId,
      mangaCustomId: manga.id,
      order: (maxOrder._max.order ?? 0) + 1
    }
  })

  return true
}
