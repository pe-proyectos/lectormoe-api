import { prisma } from "../../models/prisma";
import type { CreateSubscriptionRequest } from "../../types/subscription/create";
import { getPlanById, getSubscriptionByPaypalId, suspendSubscriptionByPaypalId } from '../../util/paypal';
import { notifyNewSubscriber } from "../../services/notify-new-chapter";
import { asegurarPrimerCobro } from "../../services/capibara-reparto";
import { LANZADO, organizacionPlataforma } from "../../util/capibara-plans";

export const createSubscription = async (organizationId: number | null, userId: number, params: CreateSubscriptionRequest) => {
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

	const planSolicitado = await prisma.subscriptionPlan.findFirst({
		where: { id: params.subscriptionPlanId },
	});
	if (!planSolicitado) {
		throw new Error(`Subscription plan '${params.subscriptionPlanId}' not found`);
	}

	// Suscripcion Capibara: el plan es de plataforma y el scan (si viene) solo
	// indica de donde llego el suscriptor, para el 25% de origen.
	// Legacy: el plan tiene que ser del scan de la pagina y, tras el
	// lanzamiento, ya no admite altas nuevas.
	let organization: Awaited<ReturnType<typeof prisma.organization.findFirst>> = null;
	let originOrganizationId: number | null = null;

	if (planSolicitado.isPlatform) {
		const plataforma = await organizacionPlataforma();
		if (organizationId && organizationId !== plataforma?.id) {
			const origen = await prisma.organization.findFirst({
				where: { id: organizationId, isDeleted: false },
				select: { id: true },
			});
			originOrganizationId = origen?.id ?? null;
		}
	} else {
		if (LANZADO) {
			throw new Error("Los planes por scan ya no admiten suscripciones nuevas. Elige un plan Capibara.");
		}
		if (!organizationId) {
			throw new Error("No se pudo identificar el scan.");
		}
		organization = await prisma.organization.findFirst({
			where: {
				id: organizationId,
				isDeleted: false,
			},
		});
		if (!organization) {
			throw new Error("Organization not found");
		}
		if (planSolicitado.organizationId !== organization.id) {
			throw new Error(`Subscription plan '${params.subscriptionPlanId}' not found`);
		}
	}

	const subscriptionPlanExists = planSolicitado;

	// Un plan retirado no se puede contratar aunque alguien conserve el enlace o
	// el boton de PayPal en cache. Las suscripciones YA existentes sobre ese plan
	// siguen su curso: esto solo cierra la puerta a altas nuevas.
	if (!subscriptionPlanExists.active) {
		throw new Error("Este plan ya no está disponible.");
	}

	const paypalPlan = await getPlanById(subscriptionPlanExists.planId);

	if (!paypalPlan) {
		throw new Error("The PayPal plan does not exist");
	}

	// validate if subscription is active
	const subscription = await getSubscriptionByPaypalId(params.paypalSubscriptionId);

	// La suscripcion de PayPal tiene que ser EXACTAMENTE la del plan reclamado.
	// Antes no se comprobaba: se podia pagar el plan barato y enviar el id del
	// caro en la peticion.
	if (!subscription || subscription.plan_id !== subscriptionPlanExists.planId) {
		throw new Error("El pago no corresponde a este plan. Escríbenos por Discord si crees que es un error.");
	}
	// Y tiene que ser de este usuario: al crearla, el frontend manda su id en
	// custom_id. Las antiguas pueden no traerlo; en ese caso no se puede comprobar.
	if (subscription.custom_id && subscription.custom_id !== String(user.id)) {
		throw new Error("Ese pago pertenece a otra cuenta.");
	}
	// Una suscripcion de PayPal solo se registra una vez. Si es del mismo
	// usuario (reintento tras un error de red) se devuelve la que ya existe.
	const yaRegistrada = await prisma.subscription.findFirst({
		where: { paypalSubscriptionId: subscription.id },
	});
	if (yaRegistrada) {
		if (yaRegistrada.userId !== user.id) throw new Error("Ese pago pertenece a otra cuenta.");
		return yaRegistrada;
	}

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
			originOrganizationId,
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
		organization &&
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
	// Notify org staff (fire-and-forget). Email dispatched 30 min later by the
	// notification cron if still unread. Plan name + amount are re-fetched from
	// the subscription row at dispatch time.
	// En un plan Capibara se avisa al scan de origen (ver notifyNewSubscriber).
	notifyNewSubscriber(createdSubscription.id).catch(console.error);
	// Plan Capibara: registrar el primer cobro sin esperar al webhook ni al cron.
	if (planSolicitado.isPlatform) asegurarPrimerCobro(createdSubscription.id);

	return createdSubscription;
};
