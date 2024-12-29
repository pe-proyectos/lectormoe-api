import { prisma } from "../../models/prisma";
import type { EditSubscriptionRequest } from "../../types/subscription/edit";
import { suspendSubscriptionByPaypalId, resumeSubscriptionByPaypalId, getSubscriptionByPaypalId } from '../../util/paypal';

export const editSubscription = async (organizationId: number, subscriptionId: number, params: EditSubscriptionRequest) => {
	const organization = await prisma.organization.findFirst({
		where: {
			id: organizationId,
		},
	});

	if (!organization) {
		throw new Error("Organization not found");
	}

	const subscription = await prisma.subscription.findFirst({
		where: {
			id: subscriptionId,
			userId: params.userId,
		},
	});

	if (!subscription) {
		throw new Error("Subscription not found");
	}

	if (params.active === true) {
		const hasAnotherActiveSubscription = await prisma.subscription.findFirst({
			where: {
				userId: params.userId,
				active: true,
			},
		});
		if (hasAnotherActiveSubscription) {
			throw new Error("User already has an active subscription");
		}
		await resumeSubscriptionByPaypalId(subscription.paypalSubscriptionId);
	} else {
		await suspendSubscriptionByPaypalId(subscription.paypalSubscriptionId);
	}

	const paypalSubscription = await getSubscriptionByPaypalId(subscription.paypalSubscriptionId);

	const updatedSubscription = await prisma.subscription.update({
		where: {
			id: subscription.id,
		},
		data: {
			status: paypalSubscription?.status,
			active: paypalSubscription?.status === "ACTIVE",
		}
	});

	return updatedSubscription;
};
