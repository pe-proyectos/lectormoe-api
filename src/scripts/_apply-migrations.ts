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
  `CREATE INDEX IF NOT EXISTS "recruitment_post_org_status_idx" ON "recruitment_post"("organizationId", "status");`
]

for (const sql of statements) {
  await prisma.$executeRawUnsafe(sql)
  console.log('OK:', sql.slice(0, 70))
}
console.log('\n✅ Migraciones aplicadas')
await prisma.$disconnect()
process.exit(0)
