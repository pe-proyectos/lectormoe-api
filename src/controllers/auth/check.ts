import { prisma } from "../../models/prisma";


export const checkToken = async (token: string) => {
    const user = await prisma.user.findFirst({
        include: {
            members: {
                include: {
                    organization: true,
                }
            }
        },
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
