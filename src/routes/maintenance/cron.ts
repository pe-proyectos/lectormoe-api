import { cron } from '@elysiajs/cron'
import { Elysia } from 'elysia'

import { prisma } from '../../models/prisma'
import { wrapCron } from '../../util/cron-alert'

// Retención de analytics. La tabla `analytics` registra una fila por evento
// (vistas, búsquedas, etc.) y crecía SIN LÍMITE (llegó a ~8.7 GB / 14.8M filas).
// Esto la mantiene acotada borrando eventos más viejos que RETENTION_DAYS.
//
// Seguro para el sitio en vivo: borra en LOTES pequeños (no un DELETE gigante que
// bloquee la tabla) y con un tope por corrida. El dashboard consulta rangos
// recientes (mes/año), así que 365 días cubre las vistas habituales. El espacio
// liberado lo reutiliza autovacuum para filas nuevas (la tabla deja de crecer);
// para DEVOLVER el espacio al disco hace falta un VACUUM FULL en ventana de
// mantenimiento (decisión manual, aparte).
const RETENTION_DAYS = 365
const BATCH = 20000
const MAX_BATCHES_PER_RUN = 12 // hasta 240k filas por corrida

async function pruneAnalytics() {
  let deleted = 0
  for (let i = 0; i < MAX_BATCHES_PER_RUN; i++) {
    const n = await prisma.$executeRawUnsafe(
      `DELETE FROM "analytics" WHERE "id" IN (
         SELECT "id" FROM "analytics"
         WHERE "capturedAt" < now() - interval '${RETENTION_DAYS} days'
         LIMIT ${BATCH}
       )`
    )
    deleted += Number(n)
    if (Number(n) < BATCH) break // ya no quedan filas viejas
  }
  if (deleted > 0) {
    console.log(`[maintenance] analytics: ${deleted} filas > ${RETENTION_DAYS}d borradas`)
  }
}

export const router = () =>
  new Elysia().use(
    cron({
      name: 'maintenance-prune-analytics',
      // Cada hora al minuto 17. Con el tope por corrida, el backlog viejo se
      // limpia en unas horas y luego solo mantiene.
      pattern: '17 * * * *',
      run: wrapCron('maintenance-prune-analytics', pruneAnalytics)
    })
  )
