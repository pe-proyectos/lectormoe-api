# Runbook operativo — LectorMoe API

Procedimientos paso a paso. **El `.env` local apunta a la base de datos de
PRODUCCIÓN** (`207.180.218.80:5432`), así que cualquier script de `src/scripts`
opera sobre datos reales. Lee el script antes de correrlo.

## Correr un script contra producción

```bash
cd lectormoe-api
bun src/scripts/<script>.ts
```

Empieza siempre por uno inofensivo de solo lectura para confirmar conexión, p. ej.:

```bash
bun src/scripts/inspect-tamt-withdrawals.ts
```

Si imprime datos sin error, la conexión y credenciales están bien.

## Aplicar migraciones (Regla 6)

No uses `prisma migrate deploy` (la tabla `_prisma_migrations` está
desincronizada). En su lugar:

1. Añade el SQL idempotente a `src/scripts/_apply-migrations.ts`
   (`ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS`, nunca DROP).
2. `bun src/scripts/_apply-migrations.ts`
3. `bunx prisma generate` y commitea `src/prisma-generated`.

El script es idempotente: correrlo dos veces no rompe nada.

## Restaurar acceso de una suscripción

Cuando un suscriptor perdió acceso pese a haber pagado (incidentes tipo
gerakun/darwin/Beli):

1. Diagnostica con el inspector correspondiente (`inspect-<caso>.ts`) o crea uno
   siguiendo el patrón: buscar la `Subscription`, revisar `active`, `endDate` y
   los `OrganizationTransaction` de PayPal.
2. Restaura con `bun src/scripts/restore-cancelled-sub-access.ts` (revisa el
   script: reactiva `active` y recalcula `endDate` con `computePaidPeriodEnd`).
3. Verifica que la web ya muestra la suscripción para el usuario.

## Re-correr el backfill de historial (siblings)

```bash
bun src/scripts/backfill-history-siblings.ts
```

Usa `createMany({ skipDuplicates: true })` por lotes; es seguro re-correrlo.

## Dedupe de géneros

```bash
bun src/scripts/unify-genres.ts            # DRY-RUN: imprime los merges que haría
bun src/scripts/unify-genres.ts --apply    # aplica (irreversible)
```

Corre SIEMPRE el dry-run primero y revisa los grupos antes de `--apply`.

## Verificar un deploy

Push a `main` auto-despliega (~3 min). Verifica con curl:

```bash
curl -s "https://capibaratraductor.com/api/landing/trending?period=day&limit=5&nsfw=false" | head
curl -s "https://capibaratraductor.com/api/landing/recently-added?limit=5&nsfw=false" | head
```

Deben responder 200 con JSON `{ status: true, data: [...] }`.

## Alertas de crons (Discord)

Configura `DISCORD_ALERTS_WEBHOOK_URL` en el entorno del servidor con la URL del
webhook del canal de alertas. Los crons envueltos con `wrapCron` reportan ahí sus
fallos. Sin la variable, las alertas se omiten silenciosamente.

## Reporte de contenido ilegal

1. El reporte llega a la cola del superadmin (tab **Reportes**).
2. Revisa el contenido; si procede, usa **Ocultar contenido**: hace soft delete
   (`deletedAt`), lo saca del público y marca como atendidos todos los reportes
   del mismo objetivo.
3. La acción queda registrada en `moderation_log` (tab **Auditoría** del
   superadmin) como constancia.
