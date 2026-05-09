import { prisma } from "../../models/prisma";

export const VALID_READING_STATUSES = [
  "READING",
  "PLAN_TO_READ",
  "COMPLETED",
  "PAUSED",
  "DROPPED",
] as const;

export type ReadingStatus = (typeof VALID_READING_STATUSES)[number];

export const setUserListReadingStatus = async (
  userId: number,
  id: number,
  status: ReadingStatus,
) => {
  if (!VALID_READING_STATUSES.includes(status)) {
    throw new Error("Estado de lectura inválido.");
  }

  const row = await prisma.userList.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!row) throw new Error("Elemento de la lista no encontrado.");

  // Keep finishedAt in sync with COMPLETED so legacy queries still work.
  const finishedAt =
    status === "COMPLETED"
      ? new Date()
      : null;

  const updated = await prisma.userList.update({
    where: { id },
    data: { readingStatus: status, finishedAt },
    select: { id: true, readingStatus: true, finishedAt: true },
  });
  return updated;
};
