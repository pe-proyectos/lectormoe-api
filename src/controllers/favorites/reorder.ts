import { prisma } from "../../models/prisma";

// Replace the user's favorites order with the provided id sequence.
// ids[0] becomes order=1, ids[1] becomes order=2, etc.
// Any favorites not in the list keep their existing order (not touched).
// Invalid ids (don't belong to this user) are silently skipped.
export const reorderFavorites = async (userId: number, ids: number[]) => {
	if (!Array.isArray(ids) || ids.length === 0) return { updated: 0 };

	// Verify the ids belong to this user — prevents cross-user tampering.
	const owned = await prisma.favorite.findMany({
		where: { userId, id: { in: ids } },
		select: { id: true },
	});
	const ownedIds = new Set(owned.map((f) => f.id));

	await prisma.$transaction(
		ids
			.filter((id) => ownedIds.has(id))
			.map((id, idx) =>
				prisma.favorite.update({
					where: { id },
					data: { order: idx + 1 },
				}),
			),
	);

	return { updated: ownedIds.size };
};
