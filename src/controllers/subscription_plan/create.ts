import { prisma } from "../../models/prisma";
import type { CreateSubscriptionPlanRequest } from "../../types/subscription_plan/create";
import { toSlug } from "../../util/slug";

export const createSubscriptionPlan = async (organizationId: number, params: CreateSubscriptionPlanRequest) => {
	const slug = toSlug(params.name);

	const organization = await prisma.organization.findFirst({
		where: {
			id: organizationId,
		},
	});

	if (!organization) {
		throw new Error("Organization not found");
	}

	const subscriptionPlanExists = await prisma.subscriptionPlan.findFirst({
		where: {
			name: params.name,
			organizationId: organization.id,
		},
	});

	if (subscriptionPlanExists) {
		throw new Error(`Your organization already has a subscription plan titled '${params.name}'`);
	}

	const subscriptionPlan = await prisma.subscriptionPlan.create({
		data: {
			organizationId: organization.id,
			name: params.name,
			slug: slug,
			description: params.description,
			price: params.price,
			interval: params.interval,
			currency: params.currency,
			planId: params.planId,
		}
	});

	return subscriptionPlan;
};
