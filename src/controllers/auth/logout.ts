import { prisma } from "../../models/prisma";


export const deleteToken = async (organizationId: number, token: string) => {
    await prisma.token.deleteMany({
        where: {
            token,
            user: {
                members: {
                    some: {
                        organizationId,
                    }
                }
            }
        },
    });
}
