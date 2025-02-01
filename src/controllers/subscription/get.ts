import { prisma } from "../../models/prisma";

export const getSubscriptionPlanBySlug = async (organizationId: number, slug: string) => {
	const subscriptionPlan = await prisma.subscriptionPlan.findFirst({
		where: {
			organizationId: organizationId,
			slug,
		},
	});

	if (!subscriptionPlan) {
		return null;
	}

	return subscriptionPlan;
};
