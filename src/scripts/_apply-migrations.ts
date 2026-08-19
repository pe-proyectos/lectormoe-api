// Aplica columnas/tablas aditivas nullable directamente (la tabla _prisma_migrations
// está desincronizada con el esquema real, así que no usamos migrate deploy).
// Todo idempotente con IF NOT EXISTS. NUNCA DROP.
import { prisma } from '../models/prisma'

const statements: string[] = [
  // Tarea 5: capítulo final
  `ALTER TABLE "manga_custom" ADD COLUMN IF NOT EXISTS "finalChapterNumber" DOUBLE PRECISION;`,
  `ALTER TABLE "manga_joint" ADD COLUMN IF NOT EXISTS "finalChapterNumber" DOUBLE PRECISION;`,
  // Tarea 17: reacciones en capítulos
  `CREATE TABLE IF NOT EXISTS "chapter_reaction" (
    "id" SERIAL PRIMARY KEY,
    "chapterId" INTEGER NOT NULL REFERENCES "chapter"("id") ON DELETE CASCADE,
    "userId" INTEGER NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "emoji" VARCHAR(8) NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now()
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "chapter_reaction_chapterId_userId_key" ON "chapter_reaction"("chapterId", "userId");`,
  `CREATE INDEX IF NOT EXISTS "chapter_reaction_chapterId_idx" ON "chapter_reaction"("chapterId");`,
  // Tarea 8: volúmenes
  `ALTER TABLE "chapter" ADD COLUMN IF NOT EXISTS "volumeNumber" INTEGER;`,
  `ALTER TABLE "manga_custom" ADD COLUMN IF NOT EXISTS "groupChaptersByVolume" BOOLEAN NOT NULL DEFAULT false;`,
  `CREATE TABLE IF NOT EXISTS "manga_volume" (
    "id" SERIAL PRIMARY KEY,
    "mangaCustomId" INTEGER REFERENCES "manga_custom"("id") ON DELETE CASCADE,
    "jointId" INTEGER REFERENCES "manga_joint"("id") ON DELETE CASCADE,
    "number" INTEGER NOT NULL,
    "title" VARCHAR(256),
    "coverUrl" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now()
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "manga_volume_mangaCustomId_number_key" ON "manga_volume"("mangaCustomId", "number");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "manga_volume_jointId_number_key" ON "manga_volume"("jointId", "number");`,
  // Tarea 18: avisos de capítulo
  `CREATE TABLE IF NOT EXISTS "chapter_milestone_alert" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "mangaCustomId" INTEGER REFERENCES "manga_custom"("id") ON DELETE CASCADE,
    "jointId" INTEGER REFERENCES "manga_joint"("id") ON DELETE CASCADE,
    "targetNumber" DOUBLE PRECISION NOT NULL,
    "triggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now()
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "chapter_milestone_alert_userId_mangaCustomId_key" ON "chapter_milestone_alert"("userId", "mangaCustomId");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "chapter_milestone_alert_userId_jointId_key" ON "chapter_milestone_alert"("userId", "jointId");`,
  `CREATE INDEX IF NOT EXISTS "chapter_milestone_alert_mangaCustomId_triggeredAt_idx" ON "chapter_milestone_alert"("mangaCustomId", "triggeredAt");`,
  // Tarea 28: reseñas
  `CREATE TABLE IF NOT EXISTS "manga_review" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "mangaCustomId" INTEGER REFERENCES "manga_custom"("id") ON DELETE CASCADE,
    "jointId" INTEGER REFERENCES "manga_joint"("id") ON DELETE CASCADE,
    "rating" INTEGER NOT NULL,
    "body" VARCHAR(500),
    "hiddenAt" TIMESTAMP(3),
    "hiddenByUserId" INTEGER REFERENCES "user"("id"),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now()
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "manga_review_userId_mangaCustomId_key" ON "manga_review"("userId", "mangaCustomId");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "manga_review_userId_jointId_key" ON "manga_review"("userId", "jointId");`,
  `CREATE INDEX IF NOT EXISTS "manga_review_mangaCustomId_hiddenAt_idx" ON "manga_review"("mangaCustomId", "hiddenAt");`,
  // Tarea 13: reportes de contenido
  `CREATE TABLE IF NOT EXISTS "content_report" (
    "id" SERIAL PRIMARY KEY,
    "reporterUserId" INTEGER NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "mangaCustomId" INTEGER REFERENCES "manga_custom"("id") ON DELETE CASCADE,
    "jointId" INTEGER REFERENCES "manga_joint"("id") ON DELETE CASCADE,
    "category" VARCHAR(40) NOT NULL,
    "details" VARCHAR(2000),
    "status" VARCHAR(16) NOT NULL DEFAULT 'pending',
    "resolutionNote" VARCHAR(1000),
    "reviewedByUserId" INTEGER REFERENCES "user"("id"),
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now()
  );`,
  `CREATE INDEX IF NOT EXISTS "content_report_status_createdAt_idx" ON "content_report"("status", "createdAt");`,
  `CREATE INDEX IF NOT EXISTS "content_report_reporterUserId_createdAt_idx" ON "content_report"("reporterUserId", "createdAt");`,
  // Tarea 27: listas públicas
  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "listIsPublic" BOOLEAN NOT NULL DEFAULT true;`,
  `CREATE TABLE IF NOT EXISTS "custom_list" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "name" VARCHAR(60) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "description" VARCHAR(500),
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now()
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "custom_list_userId_slug_key" ON "custom_list"("userId", "slug");`,
  `CREATE INDEX IF NOT EXISTS "custom_list_isPublic_updatedAt_idx" ON "custom_list"("isPublic", "updatedAt");`,
  `CREATE TABLE IF NOT EXISTS "custom_list_item" (
    "id" SERIAL PRIMARY KEY,
    "listId" INTEGER NOT NULL REFERENCES "custom_list"("id") ON DELETE CASCADE,
    "mangaCustomId" INTEGER REFERENCES "manga_custom"("id") ON DELETE CASCADE,
    "jointId" INTEGER REFERENCES "manga_joint"("id") ON DELETE CASCADE,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT now()
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "custom_list_item_listId_mangaCustomId_key" ON "custom_list_item"("listId", "mangaCustomId");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "custom_list_item_listId_jointId_key" ON "custom_list_item"("listId", "jointId");`,
  `CREATE INDEX IF NOT EXISTS "custom_list_item_listId_order_idx" ON "custom_list_item"("listId", "order");`,
  // Tarea 7: mensajería lector-scan
  `CREATE TABLE IF NOT EXISTS "organization_message_thread" (
    "id" SERIAL PRIMARY KEY,
    "organizationId" INTEGER NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
    "userId" INTEGER NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "category" VARCHAR(32) NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'open',
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now()
  );`,
  `CREATE INDEX IF NOT EXISTS "omt_org_status_last_idx" ON "organization_message_thread"("organizationId", "status", "lastMessageAt");`,
  `CREATE INDEX IF NOT EXISTS "omt_user_last_idx" ON "organization_message_thread"("userId", "lastMessageAt");`,
  `CREATE TABLE IF NOT EXISTS "organization_message" (
    "id" SERIAL PRIMARY KEY,
    "threadId" INTEGER NOT NULL REFERENCES "organization_message_thread"("id") ON DELETE CASCADE,
    "senderUserId" INTEGER NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "isStaffReply" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT now()
  );`,
  `CREATE INDEX IF NOT EXISTS "om_thread_created_idx" ON "organization_message"("threadId", "createdAt");`,
  // Tarea 16: mural de reclutamiento
  `CREATE TABLE IF NOT EXISTS "recruitment_post" (
    "id" SERIAL PRIMARY KEY,
    "organizationId" INTEGER NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(4000) NOT NULL,
    "requirements" VARCHAR(2000),
    "roles" VARCHAR(300) NOT NULL,
    "language" VARCHAR(8) NOT NULL DEFAULT 'es',
    "urgent" BOOLEAN NOT NULL DEFAULT false,
    "status" VARCHAR(16) NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now()
  );`,
  `CREATE INDEX IF NOT EXISTS "recruitment_post_status_urgent_updated_idx" ON "recruitment_post"("status", "urgent", "updatedAt");`,
  `CREATE INDEX IF NOT EXISTS "recruitment_post_org_status_idx" ON "recruitment_post"("organizationId", "status");`,
  // Tarea 30: log de auditoría de moderación
  `CREATE TABLE IF NOT EXISTS "moderation_log" (
    "id" SERIAL PRIMARY KEY,
    "actorUserId" INTEGER NOT NULL REFERENCES "user"("id"),
    "action" VARCHAR(64) NOT NULL,
    "targetType" VARCHAR(32) NOT NULL,
    "targetId" INTEGER NOT NULL,
    "details" VARCHAR(1000),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT now()
  );`,
  `CREATE INDEX IF NOT EXISTS "moderation_log_target_idx" ON "moderation_log"("targetType", "targetId");`,
  `CREATE INDEX IF NOT EXISTS "moderation_log_actor_created_idx" ON "moderation_log"("actorUserId", "createdAt");`,
  // actorUserId nullable: acciones del superadmin/sistema no tienen fila en user.
  `ALTER TABLE "moderation_log" ALTER COLUMN "actorUserId" DROP NOT NULL;`,
  // Solicitudes de alta vinculadas a la cuenta del solicitante
  `ALTER TABLE "organization_request" ADD COLUMN IF NOT EXISTS "userId" INTEGER REFERENCES "user"("id");`,
  // Texto libre en notificaciones (razón de content_removed)
  `ALTER TABLE "notification" ADD COLUMN IF NOT EXISTS "details" VARCHAR(500);`,
  // Eliminación de cuenta (requisito de Google Play): marca de borrado.
  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);`,
  // Programa de verificadores (testers) de Google Play: inscripción por usuario.
  `CREATE TABLE IF NOT EXISTS "beta_tester" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL UNIQUE REFERENCES "user"("id") ON DELETE CASCADE,
    "name" VARCHAR(256) NOT NULL,
    "gmail" VARCHAR(256) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now()
  );`,
  `CREATE INDEX IF NOT EXISTS "beta_tester_status_idx" ON "beta_tester"("status");`,
  // Estante curado del scan: recomendaciones editoriales ("La recomendación de la casa").
  `CREATE TABLE IF NOT EXISTS "organization_recommendation" (
    "id" SERIAL PRIMARY KEY,
    "organizationId" INTEGER NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
    "mangaCustomId" INTEGER REFERENCES "manga_custom"("id") ON DELETE CASCADE,
    "jointId" INTEGER REFERENCES "manga_joint"("id") ON DELETE CASCADE,
    "label" VARCHAR(80) NOT NULL DEFAULT 'La recomendación de la casa',
    "note" VARCHAR(500),
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "showOnGlobal" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now()
  );`,
  `CREATE INDEX IF NOT EXISTS "org_reco_org_active_pos_idx" ON "organization_recommendation"("organizationId", "isActive", "position");`,
  `CREATE INDEX IF NOT EXISTS "org_reco_global_active_idx" ON "organization_recommendation"("showOnGlobal", "isActive");`,
  // Título alternativo/original por obra (SEO + búsqueda).
  `ALTER TABLE "manga_custom" ADD COLUMN IF NOT EXISTS "alternativeTitle" VARCHAR(256);`,
  // NSFW deja de ser control del scan: el default pasa a false (un scan nuevo NO
  // es +18). La clasificación es por manga. Las filas existentes no cambian.
  `ALTER TABLE "organization" ALTER COLUMN "isNSFW" SET DEFAULT false;`,
  // Seguir/suscribirse a una lista pública (bookmark + avisos). Gratis para todos
  // (límite de 5 para no suscriptores en la capa de aplicación).
  `CREATE TABLE IF NOT EXISTS "custom_list_follower" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "listId" INTEGER NOT NULL REFERENCES "custom_list"("id") ON DELETE CASCADE,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT now()
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "custom_list_follower_userId_listId_key" ON "custom_list_follower"("userId", "listId");`,
  `CREATE INDEX IF NOT EXISTS "custom_list_follower_user_created_idx" ON "custom_list_follower"("userId", "createdAt");`,
  `CREATE INDEX IF NOT EXISTS "custom_list_follower_list_idx" ON "custom_list_follower"("listId");`,
  // Aviso cuando el dueño actualiza una lista seguida (type='list_updated').
  `ALTER TABLE "notification" ADD COLUMN IF NOT EXISTS "listId" INTEGER REFERENCES "custom_list"("id");`,
  // Overlay por-usuario sobre items de una lista seguida (estado de lectura + orden).
  `CREATE TABLE IF NOT EXISTS "custom_list_follower_item" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "listId" INTEGER NOT NULL REFERENCES "custom_list"("id") ON DELETE CASCADE,
    "mangaCustomId" INTEGER,
    "jointId" INTEGER,
    "readingStatus" VARCHAR(32),
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now()
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "clfi_user_list_manga_key" ON "custom_list_follower_item"("userId", "listId", "mangaCustomId");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "clfi_user_list_joint_key" ON "custom_list_follower_item"("userId", "listId", "jointId");`,
  `CREATE INDEX IF NOT EXISTS "clfi_user_list_order_idx" ON "custom_list_follower_item"("userId", "listId", "order");`
]

for (const sql of statements) {
  await prisma.$executeRawUnsafe(sql)
  console.log('OK:', sql.slice(0, 70))
}
console.log('\n✅ Migraciones aplicadas')
await prisma.$disconnect()
process.exit(0)
