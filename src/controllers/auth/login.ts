import { prisma } from "../../models/prisma";


export const login = async (email: string, password: string) => {
    const userEmailExists = await prisma.user.findFirst({
        where: { OR: [{ email: email }, { username: email }] },
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
