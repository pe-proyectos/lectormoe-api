-- Frases guardadas + flag de privacidad. Aplicado en prod el 2026-09-04.
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "savedQuotesPublic" boolean NOT NULL DEFAULT true;
CREATE TABLE IF NOT EXISTS "user_saved_quote" (
  "id" serial PRIMARY KEY,
  "userId" integer NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "text" varchar(600) NOT NULL,
  "mangaSlug" varchar(256) NOT NULL,
  "mangaTitle" varchar(256) NOT NULL,
  "chapterNumber" double precision NOT NULL,
  "displayNumber" double precision,
  "orgSlug" varchar(256),
  "workType" varchar(32),
  "createdAt" timestamp(6) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "user_saved_quote_userId_createdAt_idx" ON "user_saved_quote" ("userId","createdAt");
