import { prisma } from "../../models/prisma";
import type { CreateSubscriptionModelRequest } from "../../types/subscription-model/create";

export const createSubscriptionModel = async (organizationId: number, params: CreateSubscriptionModelRequest) => {
	const organization = await prisma.organization.findFirst({
		where: {
			id: organizationId,
		},
	});

	if (!organization) {
		throw new Error("Organization not found");
	}

	const subscriptionModelExists = await prisma.subscriptionModel.findFirst({
		where: {
			title: params.title,
			organizationId: organization.id,
		},
	});

	if (subscriptionModelExists) {
		throw new Error(`Your organization already has a subscription model titled '${params.title}'`);
	}

	const subscriptionModel = await prisma.subscriptionModel.create({
		data: {
			organizationId: organization.id,
			title: params.title,
			description: params.description,
			benefits: params.benefits,
			readAnticipationHours: params.readAnticipationHours,
			monthlyPrice: params.monthlyPrice,
			yearlyPrice: params.yearlyPrice,
			discountMonthlyPrice: params.discountMonthlyPrice,
			discountYearlyPrice: params.discountYearlyPrice,
			active: params.active,
		}
	});

	return subscriptionModel;
};

