import { prisma } from "../../models/prisma";

const FREE_FAVORITES_LIMIT = 50;
const SUBSCRIBER_FAVORITES_LIMIT = 100;

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

	const [currentCount, hasActiveSubscription] = await Promise.all([
		prisma.favorite.count({ where: { userId } }),
		prisma.subscription.findFirst({
			where: { userId, active: true },
			select: { id: true },
		}),
	]);

	const limit = hasActiveSubscription ? SUBSCRIBER_FAVORITES_LIMIT : FREE_FAVORITES_LIMIT;

	if (currentCount >= limit) {
		throw new Error(
			hasActiveSubscription
				? `Has alcanzado el limite de ${SUBSCRIBER_FAVORITES_LIMIT} favoritos.`
				: `Has alcanzado el limite de ${FREE_FAVORITES_LIMIT} favoritos. Suscribete para tener hasta ${SUBSCRIBER_FAVORITES_LIMIT}.`
		);
	}

	await prisma.favorite.create({
		data: { userId, jointId: joint.id },
	});

	return true;
};
