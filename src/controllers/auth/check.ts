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
        }
    });

    return user;
}
