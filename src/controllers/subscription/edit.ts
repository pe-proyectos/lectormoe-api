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
			cycleExecutions: paypalSubscription?.billing_info.cycle_executions.reduce((acc: number, curr: any) => acc + curr.cycles_completed, 0),
			failedPaymentsCount: paypalSubscription?.billing_info.failed_payments_count,
			nextPayment: paypalSubscription?.billing_info.next_billing_time,
			lastPayment: paypalSubscription?.billing_info.last_payment.time,
			lastAmount: parseFloat(paypalSubscription?.billing_info.last_payment.amount.value),
		}
	});

	return updatedSubscription;
};
