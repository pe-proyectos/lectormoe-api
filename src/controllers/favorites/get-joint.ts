import { prisma } from "../../models/prisma";

export const getJointFavorite = async (userId: number, jointSlug: string) => {
	const joint = await prisma.mangaJoint.findFirst({
		where: { slug: jointSlug, deletedAt: null },
		select: { id: true },
	});

	if (!joint) return false;

	const favorite = await prisma.favorite.findFirst({
		where: { userId, jointId: joint.id },
	});

	return !!favorite;
};
