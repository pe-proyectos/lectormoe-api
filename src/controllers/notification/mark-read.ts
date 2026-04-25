import { prisma } from "../../models/prisma";

export const markRead = async (userId: number, id: number) => {
	const existing = await prisma.notification.findFirst({
		where: { id, userId },
		select: { id: true, readAt: true },
	});
	if (!existing) {
		throw new Error("Notificación no encontrada.");
	}

	if (existing.readAt) {
		return { id: existing.id, readAt: existing.readAt };
	}

	const updated = await prisma.notification.update({
		where: { id },
		data: { readAt: new Date() },
		select: { id: true, readAt: true },
	});
	return updated;
};
