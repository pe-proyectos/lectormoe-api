import { prisma } from '../../models/prisma'
import { FREE_FAVORITES_LIMIT, FREE_FAVORITES_LIMIT_MESSAGE } from './constants'

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

  // Gratis: FREE_FAVORITES_LIMIT. Suscriptores activos: ilimitado.
  const hasActiveSubscription = await prisma.subscription.findFirst({
    where: { userId, active: true },
    select: { id: true }
  })

  if (!hasActiveSubscription) {
    const currentCount = await prisma.favorite.count({ where: { userId } })
    if (currentCount >= FREE_FAVORITES_LIMIT) {
      throw new Error(FREE_FAVORITES_LIMIT_MESSAGE)
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
