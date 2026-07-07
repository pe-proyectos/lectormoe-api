import { Prisma, prisma } from '../../models/prisma'

export const listComments = async (
  organizationId: number,
  identifier: string,
  admin: boolean,
  userId?: number
) => {
  const userSelect = {
    id: true,
    username: true,
    slug: true,
    imageUrl: true,
    subscriptions: {
      where: { active: true },
      select: {
        createdAt: true,
        subscriptionPlan: { select: { name: true } }
      }
    },
    permissions: {
      where: { organizationId },
      select: { role: true }
    }
  } satisfies Prisma.UserSelect

  // Consulta plana de TODOS los comentarios del hilo y se arma el árbol en
  // memoria (soporta cadenas de profundidad ilimitada, no solo 1 nivel).
  const flat = await prisma.comment.findMany({
    where: {
      organizationId,
      identifier,
      deletedAt: admin ? undefined : null,
      hiddenAt: admin ? undefined : null
    },
    orderBy: { createdAt: Prisma.SortOrder.asc },
    include: {
      user: { select: userSelect },
      likes: { where: { userId } }
    }
  })

  type Node = (typeof flat)[number] & { replies: Node[] }
  const byId = new Map<number, Node>()
  for (const c of flat) byId.set(c.id, { ...c, replies: [] })

  const roots: Node[] = []
  for (const c of flat) {
    const node = byId.get(c.id)!
    const parent = c.parentId != null ? byId.get(c.parentId) : null
    // Huérfanos (padre borrado/oculto con hard filter) suben a raíz.
    if (parent) parent.replies.push(node)
    else roots.push(node)
  }

  // Público: raíces ascendente. Admin: descendente (más nuevos primero).
  if (admin) roots.reverse()
  return roots
}
