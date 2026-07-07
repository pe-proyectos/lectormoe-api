# CLAUDE.md

Guía para Claude Code al trabajar en el API de LectorMoe (CapibaraTraductor).

## Stack

Bun + Elysia + Prisma 7 sobre PostgreSQL. Multi-tenant por organización (scan).
Respuestas con forma `{ status: boolean, data: any }`.

## Comandos

```bash
bun run dev            # API en desarrollo
bunx tsc --noEmit      # typecheck (hay ruido base de tipos de Elysia; solo cuentan errores NUEVOS)
bun test               # tests
bunx @biomejs/biome check --write src
```

## Base de datos y migraciones (Regla 6, IMPORTANTE)

La tabla `_prisma_migrations` está DESINCRONIZADA con el esquema real: **no uses
`prisma migrate deploy`**. Las migraciones aditivas (columnas nullable, tablas
nuevas) se aplican con SQL idempotente en `src/scripts/_apply-migrations.ts`
(`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`). Flujo:

1. Edita `prisma/schema.prisma` (modelo/campo nuevo, relaciones inversas).
2. Agrega el SQL idempotente en `_apply-migrations.ts`.
3. `bun src/scripts/_apply-migrations.ts` (corre contra la DB de `.env`, que apunta a PRODUCCIÓN).
4. `bunx prisma generate` (el cliente en `src/prisma-generated` se commitea).

**Nunca DROP ni borrado destructivo.** Regla de oro del proyecto: no borrar ni
perder datos. Todo cambio de esquema es aditivo o hace una columna más permisiva.

## Routing

`src/routes/<area>/index.ts` registrado en `src/routes/router.ts`. Auth:
`loggedOptional()`, `loggedUserOnly()` (requiere header `x-organization` →
`organizationId`), `loggedUserOnlyGlobal()`.

## Helpers transversales (src/util)

- `rate-limit.ts` → `assertRateLimit(key, max, windowMs)`: límites en memoria.
- `ban-check.ts` → `assertNotBanned(userId, organizationId, accion)`.
- `cron-alert.ts` → `reportCronError`, `wrapCron`: alertas de crons a Discord (`DISCORD_ALERTS_WEBHOOK_URL`).
- `moderation-log.ts` → `logModeration(actorUserId|null, action, targetType, targetId, details?)`:
  traza fire-and-forget de acciones sensibles (ver ModerationLog). `actorUserId`
  es null para acciones del superadmin (su sesión no es una fila de `user`).
- `subscription-period.ts` → `computePaidPeriodEnd`: fin del periodo pagado con
  grace period. Una suscripción está "activa" si `active && endDate` dentro del
  periodo con gracia; ver `subscription-period.test.ts`.

## Modelos y semántica añadidos por el plan de mejoras

- **Suscripciones / grace period:** `computePaidPeriodEnd` calcula hasta cuándo
  el pago cubre. Los gates de contenido premium exigen suscripción activa.
- **Siblings de capítulos** (`UserChapterHistory` fan-out): al leer un capítulo,
  se marcan como leídos los equivalentes en otras versiones/joints de la obra.
- **CustomList / CustomListItem:** listas públicas de la comunidad (slug por
  usuario). `User.listIsPublic` controla la visibilidad de la lista personal.
- **MangaReview:** reseñas con estrellas 1-5 y texto corto; `hiddenAt` +
  `hiddenByUserId` para moderación del staff (permiso `canHideComment`).
- **OrganizationMessageThread / OrganizationMessage:** mensajería lector↔scan
  (categorías gracias/sugerencia/queja/unirme/otro). Notificación
  `scan_message_reply` cuando el staff responde.
- **ContentReport:** reportes de contenido; cola en el superadmin (ocultar =
  soft delete `deletedAt`).
- **MangaVolume + Chapter.volumeNumber + MangaCustom.groupChaptersByVolume:**
  agrupación por volúmenes.
- **ChapterMilestoneAlert:** aviso cuando una obra llega a un capítulo objetivo.
- **ChapterReaction:** reacciones emoji por capítulo (una por usuario).
- **RecruitmentPost:** mural de reclutamiento de scans (roles CSV, estados
  open/filled/closed, máx 5 open por scan). Postulación reusa la mensajería.
- **ModerationLog:** auditoría de acciones sensibles (ver helper arriba).
- **Géneros globales:** deduplicados y curados (ver `scripts/unify-genres.ts`).

## Endpoints nuevos por área

- `landing/`: `trending` (día/semana/mes por lectores únicos), `recently-added`,
  `popular-today`, `featured-manga`, `sitemap-data`.
- `chapter-reaction/`, `manga-volume/`, `milestone-alert/`, `manga-review/`,
  `reports/`, `custom-list/`, `organization-messages/`, `recruitment/`.
- `superadmin/`: cola de `reports`, `moderation-log` (solo lectura), finanzas.

## Crons

Ver `src/commands` y `src/routes/notification/cron.ts`. Los crons sensibles se
envuelven con `wrapCron` para alertar fallos a Discord. Notificaciones de nuevo
capítulo hacen fan-out a seguidores y disparan milestone alerts.

## Convenciones

- Commits convencionales en inglés; sin em dashes en comentarios/UI.
- Español con acentos correctos en textos de usuario.
- Los scripts de `src/scripts` corren CONTRA PRODUCCIÓN (el `.env` apunta ahí).
  Lee `docs/runbook.md` antes de correr cualquiera.
