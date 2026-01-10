import { prisma, Prisma } from "../../models/prisma";
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
				mode: Prisma.QueryMode.insensitive,
			},
			description: {
				contains: filters.description,
				mode: Prisma.QueryMode.insensitive,
			},
		},
		orderBy: {
			createdAt: Prisma.SortOrder.desc,
		},
		skip: filters?.page ? (Number.parseInt(filters?.page || "1") - 1) * Number.parseInt(filters?.limit || "10") : 0,
		take: Number.parseInt(filters?.limit || "10"),
	});

	const total = await prisma.subscriptionPlan.count({
		where: {
			organizationId: organizationId,
			name: {
				contains: filters.name,
				mode: Prisma.QueryMode.insensitive,
			},
			description: {
				contains: filters.description,
				mode: Prisma.QueryMode.insensitive,
			},
		},
	});

	return {
		data: subscriptionPlans.map(prepareSubscriptionPlan),
		maxPage: Math.ceil(total / Number.parseInt(filters?.limit || "10")),
		total,
	};
};
