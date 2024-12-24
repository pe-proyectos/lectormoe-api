import { prisma } from "../../models/prisma";
import type { EditSubscriptionPlanRequest } from "../../types/subscription_plan/edit";
import { updatePlan, updateProduct } from '../../util/paypal';

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
    
    const updatedSubscriptionPlan = await prisma.subscriptionPlan.update({
        where: {
            id: subscriptionPlan.id,
        },
        data: {
            name: params.name,
            description: params.description,
            active: params.active,
        }
    });

    const shouldUpdatePaypalDetails = params.name !== subscriptionPlan.name || params.description !== subscriptionPlan.description;

    if (shouldUpdatePaypalDetails) {
        await updateProduct(subscriptionPlan.productId, updatedSubscriptionPlan.name, updatedSubscriptionPlan.description);

        await updatePlan(subscriptionPlan.planId, updatedSubscriptionPlan.name, updatedSubscriptionPlan.description);
    }

    return await prisma.subscriptionPlan.findFirst({ where: { id: subscriptionPlan.id } });
};
