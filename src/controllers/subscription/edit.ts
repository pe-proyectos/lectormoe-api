import { prisma } from "../../models/prisma";
import type { EditSubscriptionRequest } from "../../types/subscription/edit";
import { suspendSubscriptionByPaypalId, resumeSubscriptionByPaypalId, getSubscriptionByPaypalId } from '../../util/paypal';

export const editSubscription = async (organizationId: number, subscriptionId: number, params: EditSubscriptionRequest) => {
	const organization = await prisma.organization.findFirst({
		where: {
			id: organizationId,
			isDeleted: false,
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

	let preserveActiveUntilEndDate = false;

	if (params.active === true) {
		await resumeSubscriptionByPaypalId(subscription.paypalSubscriptionId);
	} else {
		await suspendSubscriptionByPaypalId(subscription.paypalSubscriptionId);
		// User paused — they already paid for the current billing period, so keep
		// access until next_billing_time rather than cutting it off immediately.
		preserveActiveUntilEndDate = true;
	}

	const paypalSubscription = await getSubscriptionByPaypalId(subscription.paypalSubscriptionId);

	const billing = paypalSubscription?.billing_info ?? {};
	const nextBillingTime = billing.next_billing_time ? new Date(billing.next_billing_time) : null;
	const now = new Date();
	// When pausing, keep active if there's still paid time remaining.
	const keepActive = preserveActiveUntilEndDate
		? (nextBillingTime ? nextBillingTime > now : false)
		: paypalSubscription?.status === "ACTIVE";

	const updatedSubscription = await prisma.subscription.update({
		where: {
			id: subscription.id,
		},
		data: {
			status: paypalSubscription?.status,
			active: keepActive,
			// Record when access should end for paused/cancelled subs
			endDate: preserveActiveUntilEndDate ? (nextBillingTime ?? now) : null,
			cycleExecutions: (billing.cycle_executions ?? []).reduce((acc: number, curr: any) => acc + curr.cycles_completed, 0),
			failedPaymentsCount: billing.failed_payments_count,
			nextPayment: billing.next_billing_time ? new Date(billing.next_billing_time) : null,
			lastPayment: billing.last_payment?.time ? new Date(billing.last_payment.time) : undefined,
			lastAmount: billing.last_payment?.amount?.value ? parseFloat(billing.last_payment.amount.value) : undefined,
		}
	});

	return updatedSubscription;
};
