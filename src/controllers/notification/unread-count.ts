import { prisma } from "../../models/prisma";

export const unreadCount = async (userId: number) => {
	const count = await prisma.notification.count({
		where: { userId, readAt: null },
	});
	return { count };
};
