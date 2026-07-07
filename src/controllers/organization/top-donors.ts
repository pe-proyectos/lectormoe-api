import { prisma } from "../../models/prisma";

export const getTopDonors = async (organizationId: number) => {
	const now = new Date();
	
	// Solo considerar suscripciones con acceso vigente:
	// - active = true (fuente de verdad de nuestra plataforma)
	// - endDate es null (sin vencimiento) O endDate > now (período de gracia tras cancelar)
	// No filtramos por status de PayPal porque usuarios que cancelaron el cobro recurrente
	// pero ya pagaron el mes pueden tener status='CANCELLED' y aún tener active=true.
	const subscriptions = await prisma.subscription.findMany({
		where: {
			AND: [
				{ organizationId: organizationId },
				{ active: true },
				{
					OR: [
						{ endDate: null },
						{ endDate: { gt: now } }
					]
				}
			]
		},
		select: {
			id: true,
			startDate: true,
			user: {
				select: {
					id: true,
					username: true,
					slug: true,
					imageUrl: true,
				}
			},
			subscriptionPlan: {
				select: {
					id: true,
					name: true,
					price: true,
				}
			}
		}
	});

	const donorsWithDays = subscriptions.map((sub) => {
		// Calcular días desde el inicio de la suscripción
		const startDate = new Date(sub.startDate);
		const now = new Date();
		const diffTime = Math.abs(now.getTime() - startDate.getTime());
		const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

		return {
			id: sub.user.id,
			username: sub.user.username,
			slug: sub.user.slug,
			imageUrl: sub.user.imageUrl,
			days: diffDays,
			subscriptionPlan: {
				id: sub.subscriptionPlan.id,
				name: sub.subscriptionPlan.name,
				price: sub.subscriptionPlan.price,
			},
			subscriptionId: sub.id,
		};
	});

	// Ordenar por días (descendente)
	return donorsWithDays.sort((a, b) => b.days - a.days);
};

