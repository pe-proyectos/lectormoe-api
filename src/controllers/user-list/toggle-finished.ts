import { prisma } from "../../models/prisma";

export const toggleUserListFinished = async (userId: number, id: number, finished: boolean) => {
	const row = await prisma.userList.findFirst({
		where: { id, userId },
		select: { id: true, finishedAt: true },
	});
	if (!row) throw new Error("Elemento de la lista no encontrado.");

	const updated = await prisma.userList.update({
		where: { id },
		data: { finishedAt: finished ? new Date() : null },
		select: { id: true, finishedAt: true },
	});
	return updated;
};
