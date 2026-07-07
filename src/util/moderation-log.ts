import { prisma } from '../models/prisma'

// Registra una accion sensible de moderacion (Tarea 30). Fire-and-forget: nunca
// debe interrumpir el flujo principal, por eso captura cualquier error.
export function logModeration(
  actorUserId: number | null,
  action: string,
  targetType: string,
  targetId: number,
  details?: string,
) {
  prisma.moderationLog
    .create({ data: { actorUserId, action, targetType, targetId, details: details?.slice(0, 1000) } })
    .catch((e) => console.error('logModeration failed:', e?.message))
}
