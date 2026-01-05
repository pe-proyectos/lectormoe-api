import { prisma } from "../../models/prisma";


export const login = async (organizationId: number | null, email: string, password: string) => {
    // Buscar usuario por email o username (sin filtrar por organización)
    const userEmailExists = await prisma.user.findFirst({
        where: {
            OR: [{ email: email }, { username: email }],
        },
        select: {
            id: true,
            password: true,
        }
    });

    if (!userEmailExists) {
        throw new Error("El usuario/email/contraseña son incorrectos.");
    }

    const isMatch = await Bun.password.verify(password, userEmailExists.password);

    if (!isMatch) {
        throw new Error("El usuario/email/contraseña son incorrectos.");
    }

    // Si se proporciona organizationId, verificar que el usuario tenga permisos para esta organización
    if (organizationId !== null) {
        const permission = await prisma.permission.findUnique({
            where: {
                userId_organizationId: {
                    userId: userEmailExists.id,
                    organizationId,
                },
            },
        });

        if (!permission) {
            throw new Error("El usuario no tiene acceso a esta organización.");
        }
    }

    const user = await prisma.user.findUnique({
        where: {
            id: userEmailExists.id,
        },
    });

    delete user?.password;

    return user;
};
