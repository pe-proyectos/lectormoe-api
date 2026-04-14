import { prisma } from "../../models/prisma";

export const deleteJointFavorite = async (userId: number, jointSlug: string) => {
	const joint = await prisma.mangaJoint.findFirst({
		where: { slug: jointSlug, deletedAt: null },
		select: { id: true },
	});

	if (!joint) return false;

	const existing = await prisma.favorite.findFirst({
		where: { userId, jointId: joint.id },
	});

	if (!existing) return false;

	await prisma.favorite.delete({ where: { id: existing.id } });

	return true;
};
