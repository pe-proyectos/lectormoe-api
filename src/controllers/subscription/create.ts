import { prisma } from "../../models/prisma";
import type { CreateSubscriptionRequest } from "../../types/subscription/create";
import { getPlanById, getSubscriptionByPaypalId, suspendSubscriptionByPaypalId } from '../../util/paypal';
import { sendNewSubscriberNotification } from "../../services/email-notifications";

export const createSubscription = async (organizationId: number, userId: number, params: CreateSubscriptionRequest) => {
	const organization = await prisma.organization.findFirst({
		where: {
			id: organizationId,
			isDeleted: false,
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
						cycleExecutions: disabledPaypalSubscription?.billing_info.cycle_executions.reduce((acc: number, curr: any) => acc + curr.cycles_completed, 0),
						failedPaymentsCount: disabledPaypalSubscription?.billing_info.failed_payments_count,
						nextPayment: disabledPaypalSubscription?.billing_info.next_billing_time,
						lastPayment: disabledPaypalSubscription?.billing_info.last_payment.time,
						lastAmount: parseFloat(disabledPaypalSubscription?.billing_info.last_payment.amount.value),
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
			organizationId: subscriptionPlanExists.organizationId,
			paypalSubscriptionId: subscription.id,
			status: subscription.status,
			startDate: subscription.start_time,
			active: subscription.status === "ACTIVE",
			cycleExecutions: subscription?.billing_info.cycle_executions.reduce((acc: number, curr: any) => acc + curr.cycles_completed, 0),
			failedPaymentsCount: subscription?.billing_info.failed_payments_count,
			nextPayment: subscription?.billing_info.next_billing_time,
			lastPayment: subscription?.billing_info.last_payment.time,
			lastAmount: parseFloat(subscription?.billing_info.last_payment.amount.value),
		}
	});

	if (
		organization.enableDiscordWebhookNewSubscription &&
		organization.discordWebhookUrlNewSubscription
	) {
		try {
			const description =
				organization.discordWebhookMessageTemplateNewSubscription
					?.replaceAll("%user%", user.username || user.email || "Usuario desconocido")
					.replaceAll("%plan%", subscriptionPlanExists.name || paypalPlan?.name || "Plan sin nombre")
					.replaceAll("%amount%", `${subscription?.billing_info?.last_payment?.amount?.value || "0"} USD`)
					.replaceAll("%scan%", organization.name || '');

			const message = {
				username: organization.name,
				embeds: [
					{
						title: "💎 - Nueva suscripción activada",
						description: description,
						color: 0x00b0f4,
						timestamp: new Date().toISOString(),
					},
				],
			};

			await fetch(organization.discordWebhookUrlNewSubscription, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(message),
			});
		} catch (error) {
			console.error("Error al enviar el webhook de suscripción a Discord:", error);
		}
	}
	// Send email notification to organization staff (fire-and-forget)
	const amount = `${subscription?.billing_info?.last_payment?.amount?.value || "0"} USD`;
	sendNewSubscriberNotification(
		organizationId,
		user.id,
		subscriptionPlanExists.name || paypalPlan?.name || "Plan sin nombre",
		amount
	).catch(console.error);

	return createdSubscription;
};
