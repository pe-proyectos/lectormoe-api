import { Elysia, t } from 'elysia'
import { prisma } from '../../models/prisma'
import { loggedUserOnlyGlobal } from '../../plugins/auth'

// Eliminación de cuenta a petición del usuario (requisito de Google Play).
// No se hace un DELETE físico para no romper integridad ni el historial de la
// plataforma (comentarios, transacciones financieras, etc.): se ANONIMIZA la
// identidad (email, contraseña, nombre, foto) y se marca deletedAt, con lo que
// el login queda bloqueado y no queda ningún dato personal asociado.
export const router = () =>
  new Elysia().use(loggedUserOnlyGlobal()).post(
    '/api/user/delete-account',
    async ({ user, body }) => {
      // Confirmación: el cliente debe reenviar la contraseña actual.
      const current = await prisma.user.findUnique({
        where: { id: user.id },
        select: { password: true, deletedAt: true }
      })
      if (!current) throw new Error('Cuenta no encontrada.')
      if (current.deletedAt) return { status: true, data: { alreadyDeleted: true } }
      const ok = await Bun.password.verify(body.password, current.password)
      if (!ok) throw new Error('La contraseña no es correcta.')

      const stamp = Date.now()
      await prisma.$transaction([
        // Anonimiza los datos personales y bloquea el acceso.
        prisma.user.update({
          where: { id: user.id },
          data: {
            deletedAt: new Date(),
            email: `deleted+${user.id}.${stamp}@capibaratraductor.com`,
            username: `usuario-eliminado-${user.id}`,
            slug: `usuario-eliminado-${user.id}`,
            password: `deleted-${stamp}`,
            imageUrl: null,
            emailNotifications: false
          }
        }),
        // Borra tokens de sesión (cierra sesión en todos lados).
        prisma.token.deleteMany({ where: { userId: user.id } }),
        // Borra datos personales no esenciales.
        prisma.userList.deleteMany({ where: { userId: user.id } }),
        prisma.favorite.deleteMany({ where: { userId: user.id } }),
        prisma.notification.deleteMany({ where: { userId: user.id } })
      ])

      return { status: true, data: { deleted: true } }
    },
    {
      body: t.Object({ password: t.String() }),
      response: t.Object({ status: t.Boolean(), data: t.Any() })
    }
  )
