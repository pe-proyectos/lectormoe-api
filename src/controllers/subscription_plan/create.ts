import { prisma } from "../../models/prisma";
import type { CreateSubscriptionPlanRequest } from "../../types/subscription_plan/create";
import { toSlug } from "../../util/slug";
import { createPlan, createProduct } from '../../util/paypal';

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

	const paypalProduct = await createProduct(params.name, params.name);

	const paypalPlan = await createPlan({
		productId: paypalProduct.id,
		name: params.name,
		description: params.name,
		price: params.price,
		currency: params.currency,
		interval: params.interval as "DAY" | "WEEK" | "MONTH" | "YEAR",
	});

	const subscriptionPlan = await prisma.subscriptionPlan.create({
		data: {
			organizationId: organization.id,
			name: params.name,
			slug: slug,
			description: params.description,
			price: params.price,
			interval: params.interval,
			currency: params.currency,
			productId: paypalProduct.id,
			active: params.active,
			planId: paypalPlan.id,
			showAds: params.showAds,
			canDownload: params.canDownload,
			canReadUnreleased: params.canReadUnreleased,
		}
	});

	return subscriptionPlan;
};
