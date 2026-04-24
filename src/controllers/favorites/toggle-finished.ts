import { prisma } from "../../models/prisma";

// Toggle the finished-reading state on a favorite row. Only the owner can
// change this — caller must provide userId and ownership is enforced here.
export const toggleFavoriteFinished = async (userId: number, id: number, finished: boolean) => {
	const row = await prisma.favorite.findFirst({
		where: { id, userId },
		select: { id: true, finishedAt: true },
	});
	if (!row) throw new Error("Favorito no encontrado.");

	const updated = await prisma.favorite.update({
		where: { id },
		data: { finishedAt: finished ? new Date() : null },
		select: { id: true, finishedAt: true },
	});
	return updated;
};
