import { prisma } from "../../models/prisma";

export const getSubscriptionModelByTitle = async (organizationId: number, title: string) => {
	const subscriptionModel = await prisma.subscriptionModel.findFirst({
		where: {
			organizationId: organizationId,
			title: title,
		},
		include: {
			subscriptions: {
				orderBy: {
					createdAt: "desc",
				},
			},
		},
	});
	if (!subscriptionModel) {
		return null;
	}
	const result = {
		...subscriptionModel,
	}
	return result;
};

