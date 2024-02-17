import prisma from "../../models/prisma";


export const login = async (email: string, password: string) => {
    const userEmailExists = await prisma.user.findFirst({
        where: { email },
        select: {
            id: true,
            username: true,
            password: true,
            slug: true,
        }
    });

    if (!userEmailExists) {
        throw new Error("El correo no está registrado.");
    }

    const isMatch = await Bun.password.verify(password, userEmailExists.password);

    if (!isMatch) {
        throw new Error("La contraseña es incorrecta.");
    }

    return userEmailExists;
};
