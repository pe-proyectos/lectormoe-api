import { prisma } from "../../models/prisma";


export const createToken = async (token: string, userId: number) => {
    return await prisma.token.create({
        data: {
            token,
            userId: userId,
        },
    });
}
