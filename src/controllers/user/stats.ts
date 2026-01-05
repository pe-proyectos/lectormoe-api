import { prisma } from "../../models/prisma";

export const getUserStats = async (userId: number) => {
  // Get user to calculate active days
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      createdAt: true,
    },
  });

  if (!user) {
    throw new Error("Usuario no encontrado");
  }

  // Calculate active days
  const activeDays = Math.floor(
    (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Count chapters with finishedAt null (to read)
  const toReadCount = await prisma.userChapterHistory.count({
    where: {
      userId,
      finishedAt: null,
    },
  });

  // Count chapters with finishedAt not null (read)
  const readCount = await prisma.userChapterHistory.count({
    where: {
      userId,
      finishedAt: {
        not: null,
      },
    },
  });

  return {
    activeDays,
    toRead: toReadCount,
    read: readCount,
  };
};

