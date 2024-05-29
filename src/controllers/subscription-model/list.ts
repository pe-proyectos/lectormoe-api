import { prisma } from "../../models/prisma";
import { type SubscriptionModelListQuery } from "../../types/subscription-model/list";

const prepareSubscriptionModel = (subscriptionModel: any) => {
	const result = {
		...subscriptionModel,
	};
	return result;
}

export const listSubscriptionModels = async (organizationId: number, filters: SubscriptionModelListQuery) => {
	const subscriptionModels = await prisma.subscriptionModel.findMany({
		where: {
			organizationId: organizationId,
			title: {
				contains: filters.title,
				mode: "insensitive"
			},
			description: {
				contains: filters.description,
				mode: "insensitive"
			},
		},
		skip: filters?.page ? (Number.parseInt(filters?.page || "1") - 1) * Number.parseInt(filters?.limit || "10") : 0,
		take: Number.parseInt(filters?.limit || "10"),
	});

	const total = await prisma.subscriptionModel.count({
		where: {
			organizationId: organizationId,
			title: {
				contains: filters.title,
				mode: "insensitive"
			},
			description: {
				contains: filters.description,
				mode: "insensitive"
			},
		},
	});

	return {
		data: subscriptionModels.map(prepareSubscriptionModel),
		maxPage: Math.ceil(total / Number.parseInt(filters?.limit || "10")),
		total,
	};
};
