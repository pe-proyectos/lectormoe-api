import { prisma } from "../../models/prisma";


export const login = async (organizationId: number, email: string, password: string) => {
    const userEmailExists = await prisma.user.findFirst({
        where: {
            organizationId,
            OR: [{ email: email }, { username: email }],
            members: {
                some: {
                    organizationId,
                }
            },
        },
        select: {
            id: true,
            username: true,
            password: true,
            slug: true,
        }
    });

    if (!userEmailExists) {
        throw new Error("El usuario/email/contraseña son incorrectos.");
    }

    const isMatch = await Bun.password.verify(password, userEmailExists.password);

    if (!isMatch) {
        throw new Error("El usuario/email/contraseña son incorrectos.");
    }

    return userEmailExists;
};
