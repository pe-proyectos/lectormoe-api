import { prisma } from "../../models/prisma";
import type { EditSubscriptionModelRequest } from "../../types/subscription-model/edit";

export const editSubscriptionModel = async (organizationId: number, subscriptionModelId: number, params: EditSubscriptionModelRequest) => {
    const subscriptionModel = await prisma.subscriptionModel.findFirst({
        where: {
            id: subscriptionModelId,
            organizationId,
        },
    });

    if (!subscriptionModel) {
        throw new Error("Subscription model not found for this organization");
    }
    
    await prisma.subscriptionModel.update({
        where: {
            id: subscriptionModel.id,
        },
        data: {
            title: params.title,
            description: params.description,
            benefits: params.benefits,
            readAnticipationHours: params.readAnticipationHours,
            monthlyPrice: params.monthlyPrice,
            yearlyPrice: params.yearlyPrice,
            discountMonthlyPrice: params.discountMonthlyPrice,
            discountYearlyPrice: params.discountYearlyPrice,
            active: params.active,
        }
    });

    return await prisma.subscriptionModel.findFirst({ where: { id: subscriptionModel.id } });
};

