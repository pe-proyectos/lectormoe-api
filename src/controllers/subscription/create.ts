import { prisma } from "../../models/prisma";
import type { CreateSubscriptionRequest } from "../../types/subscription/create";
import { getPlanById, getSubscriptionByPaypalId, suspendSubscriptionByPaypalId } from '../../util/paypal';

export const createSubscription = async (organizationId: number, userId: number, params: CreateSubscriptionRequest) => {
	const organization = await prisma.organization.findFirst({
		where: {
			id: organizationId,
		},
	});

	if (!organization) {
		throw new Error("Organization not found");
	}

	const user = await prisma.user.findFirst({
		where: {
			id: userId,
		},
	});

	if (!user) {
		throw new Error("User not found");
	}

	if (user.id !== params.userId) {
		throw new Error("User ID does not match");
	}

	const subscriptionPlanExists = await prisma.subscriptionPlan.findFirst({
		where: {
			id: params.subscriptionPlanId,
			organizationId: organization.id,
		},
	});

	if (!subscriptionPlanExists) {
		throw new Error(`Subscription plan '${params.subscriptionPlanId}' not found`);
	}

	const paypalPlan = await getPlanById(subscriptionPlanExists.planId);

	if (!paypalPlan) {
		throw new Error("The PayPal plan does not exist");
	}

	// validate if subscription is active
	const subscription = await getSubscriptionByPaypalId(params.paypalSubscriptionId);
	// if active disactive previous subscriptions

	if (subscription.status === "ACTIVE") {
		const previousSubscriptions = await prisma.subscription.findMany({
			where: {
				userId: user.id,
				active: true,
			},
		});
		for (const previousSubscription of previousSubscriptions) {
			try {
				await suspendSubscriptionByPaypalId(previousSubscription.paypalSubscriptionId);
				const disabledPaypalSubscription = await getSubscriptionByPaypalId(previousSubscription.paypalSubscriptionId);
				await prisma.subscription.update({
					where: { id: previousSubscription.id },
					data: {
						active: disabledPaypalSubscription?.status === "ACTIVE",
						status: disabledPaypalSubscription?.status,
						endDate: new Date(),
					},
				});
			} catch (error) {
				console.error(error);
			}
		}
	}

	const createdSubscription = await prisma.subscription.create({
		data: {
			userId: user.id,
			subscriptionPlanId: subscriptionPlanExists.id,
			paypalSubscriptionId: subscription.id,
			status: subscription.status,
			startDate: subscription.start_time,
			lastPayment: subscription.billing_info.last_payment.time,
			active: subscription.status === "ACTIVE",
		}
	});

	return createdSubscription;
};
