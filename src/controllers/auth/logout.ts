import { prisma } from "../../models/prisma";


export const deleteToken = async (token: string) => {
    await prisma.token.deleteMany({
        where: {
            token,
        },
    });
}
