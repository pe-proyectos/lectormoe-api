import { Elysia, t } from 'elysia'
import { prisma } from '../../models/prisma'
import { loggedUserOnlyGlobal } from '../../plugins/auth'

// Borrado de DATOS del usuario SIN eliminar la cuenta (requisito de Google Play,
// distinto de eliminar la cuenta). Limpia los datos de actividad/personales
// asociados: lista personal, favoritos, notificaciones e historial de lectura.
// La cuenta sigue existiendo y utilizable.
export const router = () =>
  new Elysia().use(loggedUserOnlyGlobal()).post(
    '/api/user/delete-data',
    async ({ user }) => {
      const [list, fav, notif, history] = await prisma.$transaction([
        prisma.userList.deleteMany({ where: { userId: user.id } }),
        prisma.favorite.deleteMany({ where: { userId: user.id } }),
        prisma.notification.deleteMany({ where: { userId: user.id } }),
        prisma.userChapterHistory.deleteMany({ where: { userId: user.id } })
      ])
      return {
        status: true,
        data: {
          removed: {
            listas: list.count,
            favoritos: fav.count,
            notificaciones: notif.count,
            historial: history.count
          }
        }
      }
    },
    { response: t.Object({ status: t.Boolean(), data: t.Any() }) }
  )
