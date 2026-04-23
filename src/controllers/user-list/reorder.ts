import { prisma } from "../../models/prisma";

export const reorderUserList = async (userId: number, ids: number[]) => {
	if (!Array.isArray(ids) || ids.length === 0) return { updated: 0 };

	const owned = await prisma.userList.findMany({
		where: { userId, id: { in: ids } },
		select: { id: true },
	});
	const ownedIds = new Set(owned.map((f) => f.id));

	await prisma.$transaction(
		ids
			.filter((id) => ownedIds.has(id))
			.map((id, idx) =>
				prisma.userList.update({
					where: { id },
					data: { order: idx + 1 },
				}),
			),
	);

	return { updated: ownedIds.size };
};
