import { prisma } from '../../models/prisma'
import { limitesDeUsuario } from '../../util/capibara-plans'

export const saveJointFavorite = async (userId: number, jointSlug: string) => {
  const joint = await prisma.mangaJoint.findFirst({
    where: { slug: jointSlug, deletedAt: null },
    select: { id: true }
  })

  if (!joint) return false

  const existing = await prisma.favorite.findFirst({
    where: { userId, jointId: joint.id }
  })

  if (existing) return true

  // Mismo tope que los favoritos de manga: depende del nivel del usuario.
  const { favoritos } = await limitesDeUsuario(userId)
  if (favoritos !== null) {
    const currentCount = await prisma.favorite.count({ where: { userId } })
    if (currentCount >= favoritos) {
      throw new Error(`Has alcanzado el límite de ${favoritos} favoritos. Mejora tu plan para guardar más.`)
    }
  }

  const maxOrder = await prisma.favorite.aggregate({
    where: { userId },
    _max: { order: true }
  })
  await prisma.favorite.create({
    data: {
      userId,
      jointId: joint.id,
      order: (maxOrder._max.order ?? 0) + 1
    }
  })

  return true
}
