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

	const total = await prisma.subscriptionPlan.count({
		where: countWhereClause,
	});

	return {
		data: subscriptionPlans.map(prepareSubscriptionPlan),
		maxPage: Math.ceil(total / Number.parseInt(filters?.limit || "10")),
		total,
	};
};
