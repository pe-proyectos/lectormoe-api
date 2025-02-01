import { prisma } from "../../models/prisma";
import { type SubscriptionPlanListQuery } from "../../types/subscription_plan/list";

const prepareSubscriptionPlan = (subscriptionPlan: any) => {
	return {
		...subscriptionPlan,
	};
}

export const listSubscriptionPlans = async (organizationId: number, filters: SubscriptionPlanListQuery) => {
	const subscriptionPlans = await prisma.subscriptionPlan.findMany({
		where: {
			organizationId: organizationId,
			name: {
				contains: filters.name,
				mode: "insensitive"
			},
			description: {
				contains: filters.description,
				mode: "insensitive"
			},
		},
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
					startDate: "asc",
				},
				where: {
					active: true,
				}

			},
		},
		orderBy: {
			createdAt: "desc",
		},
		skip: filters?.page ? (Number.parseInt(filters?.page || "1") - 1) * Number.parseInt(filters?.limit || "10") : 0,
		take: Number.parseInt(filters?.limit || "10"),
	});

	const total = await prisma.subscriptionPlan.count({
		where: {
			organizationId: organizationId,
			name: {
				contains: filters.name,
				mode: "insensitive"
			},
			description: {
				contains: filters.description,
				mode: "insensitive"
			},
		},
	});

	return {
		data: subscriptionPlans.map(prepareSubscriptionPlan),
		maxPage: Math.ceil(total / Number.parseInt(filters?.limit || "10")),
		total,
	};
};
