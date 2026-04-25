-- Enforces "at most one active joint per base manga" at the DB level.
-- Prisma schema lacks a clean way to express partial uniques, so the orchestrator
-- runs this against prod manually after `prisma db push`.
CREATE UNIQUE INDEX IF NOT EXISTS manga_joint_active_unique
  ON manga_joint ("mangaId")
  WHERE "deletedAt" IS NULL;
