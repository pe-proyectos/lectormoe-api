import { prisma } from "../../models/prisma";

export const markAllRead = async (userId: number) => {
	const result = await prisma.notification.updateMany({
		where: { userId, readAt: null },
		data: { readAt: new Date() },
	});
	return { updated: result.count };
};
