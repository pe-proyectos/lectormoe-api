import { getActiveBan } from '../controllers/comment/ban-user'

// Verificación reutilizable de ban para endpoints de escritura con contexto
// de scan (Regla 9 del plan). Los bans son por organización: NO aplica a
// acciones globales (listas, reportes).
export async function assertNotBanned(
  userId: number,
  organizationId: number,
  accion = 'hacer esto'
) {
  const ban = await getActiveBan(userId, organizationId)
  if (ban) {
    throw new Error(
      `No puedes ${accion}: estás baneado o restringido en este scan.${ban.reason ? ` Motivo: ${ban.reason}` : ''}`
    )
  }
}
