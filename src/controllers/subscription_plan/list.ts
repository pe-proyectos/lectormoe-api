import { prisma, Prisma } from "../../models/prisma";
import { type SubscriptionPlanListQuery } from "../../types/subscription_plan/list";

const prepareSubscriptionPlan = (subscriptionPlan: any) => {
	return {
		...subscriptionPlan,
	};
}

export const listSubscriptionPlans = async (organizationId: number | null, filters: SubscriptionPlanListQuery) => {
	const whereClause: any = {
		name: {
			contains: filters.name,
			mode: Prisma.QueryMode.insensitive,
		},
		description: {
			contains: filters.description,
			mode: Prisma.QueryMode.insensitive,
		},
	};

	// If organizationId is provided, filter by it. Otherwise, return all plans
	if (organizationId !== null) {
		whereClause.organizationId = organizationId;
	}

	// Visibilidad del plan. Antes no habia filtro: desactivar un plan en el panel
	// no lo quitaba de la pagina publica, seguia listandose y se podia contratar.
	// Ahora el valor por defecto es "solo activos"; el panel pide 'all' a
	// proposito porque necesita ver los retirados para reactivarlos.
	const activeFilter = String(filters?.active ?? 'true').toLowerCase();
	if (activeFilter !== 'all') {
		whereClause.active = activeFilter !== 'false';
	}

	const subscriptionPlans = await prisma.subscriptionPlan.findMany({
		where: whereClause,
		include: {
			subscriptions: {
				select: {
					startDate: true,
					user: {
						select: {
							username: true,
						}
					},
				},
				orderBy: {
					startDate: Prisma.SortOrder.asc,
				},
				where: {
					active: true,
				}

			},
		},
		orderBy: {
			createdAt: Prisma.SortOrder.desc,
		},
		skip: filters?.page ? (Number.parseInt(filters?.page || "1") - 1) * Number.parseInt(filters?.limit || "10") : 0,
		take: Number.parseInt(filters?.limit || "10"),
	});

	const countWhereClause: any = {
		name: {
			contains: filters.name,
			mode: Prisma.QueryMode.insensitive,
		},
		description: {
			contains: filters.description,
			mode: Prisma.QueryMode.insensitive,
		},
	};

	// If organizationId is provided, filter by it. Otherwise, count all plans
	if (organizationId !== null) {
		countWhereClause.organizationId = organizationId;
	}

	// El recuento tiene que usar el mismo criterio que el listado.
	if (activeFilter !== 'all') {
		countWhereClause.active = activeFilter !== 'false';
	}

	const total = await prisma.subscriptionPlan.count({
		where: countWhereClause,
	});

	return {
		data: subscriptionPlans.map(prepareSubscriptionPlan),
		maxPage: Math.ceil(total / Number.parseInt(filters?.limit || "10")),
		total,
	};
};
