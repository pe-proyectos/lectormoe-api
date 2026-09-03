-- Numeracion mostrada por tomo (aditivo, nullable). Aplicado en prod el 2026-09-03.
ALTER TABLE "chapter" ADD COLUMN IF NOT EXISTS "displayNumber" double precision;
