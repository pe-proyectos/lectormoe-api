import { prisma } from "../../models/prisma";
import type { EditSubscriptionPlanRequest } from "../../types/subscription_plan/edit";

export const editSubscriptionPlan = async (organizationId: number, subscriptionPlanId: number, params: EditSubscriptionPlanRequest) => {
    const subscriptionPlan = await prisma.subscriptionPlan.findFirst({
        where: {
            id: subscriptionPlanId,
            organizationId,
        },
    });

    if (!subscriptionPlan) {
        throw new Error("Subscription plan not found for this organization");
    }
    
    await prisma.subscriptionPlan.update({
        where: {
            id: subscriptionPlan.id,
        },
        data: {
            name: params.name,
            description: params.description,
            price: params.price,
            interval: params.interval,
            currency: params.currency,
            planId: params.planId,
        }
    });

    return await prisma.subscriptionPlan.findFirst({ where: { id: subscriptionPlan.id } });
};
