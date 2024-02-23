import { prisma } from "../../models/prisma";


export const checkToken = async (token: string) => {
    const user = await prisma.user.findFirst({
        where: {
            tokens: {
                some: {
                    token,
                }
            }
        }
    });
    return user;
}
