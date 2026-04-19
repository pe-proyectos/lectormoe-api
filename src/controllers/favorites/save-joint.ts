import { prisma } from "../../models/prisma";

const FREE_FAVORITES_LIMIT = 50;

export const saveJointFavorite = async (userId: number, jointSlug: string) => {
	const joint = await prisma.mangaJoint.findFirst({
		where: { slug: jointSlug, deletedAt: null },
		select: { id: true },
	});

	if (!joint) return false;

	const existing = await prisma.favorite.findFirst({
		where: { userId, jointId: joint.id },
	});

	if (existing) return true;

	// Gratis: 50. Suscriptores activos: ilimitado.
	const hasActiveSubscription = await prisma.subscription.findFirst({
		where: { userId, active: true },
		select: { id: true },
	});

	if (!hasActiveSubscription) {
		const currentCount = await prisma.favorite.count({ where: { userId } });
		if (currentCount >= FREE_FAVORITES_LIMIT) {
			throw new Error(
				`Has alcanzado el límite de ${FREE_FAVORITES_LIMIT} favoritos del plan gratuito. Suscríbete para tener favoritos ilimitados.`
			);
		}
	}

	await prisma.favorite.create({
		data: { userId, jointId: joint.id },
	});

	return true;
};
