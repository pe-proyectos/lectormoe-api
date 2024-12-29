import { prisma } from "../../models/prisma";

export const checkToken = async (organizationId: number, token: string) => {
    const user = await prisma.user.findFirst({
        where: {
            organizationId,
            tokens: {
                some: {
                    token,
                }
            }
        },
        include: {
            subscriptions: {
                where: {
                    active: true,
                },
                select: {
                    id: true,
                    startDate: true,
                    lastPayment: true,
                    nextPayment: true,
                    subscriptionPlan: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                            interval: true,
                            currency: true,
                            hideAds: true,
                            canDownload: true,
                            canReadUnreleased: true,
                            active: true,
                        },
                    },
                },
            },
        },
    });

    if (user) {
        user.password = "********";
    }

    return user;
}

