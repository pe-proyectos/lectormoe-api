import slug from "slug";

import { prisma } from "../../models/prisma";


export const register = async (organizationId: number, email: string, username: string, password: string) => {
	const userEmailExists = await prisma.user.findFirst({ where: { email, organizationId } });
	if (userEmailExists) {
		throw new Error("El correo ya está en uso.");
    }
    const userUsernameExists = await prisma.user.findFirst({ where: { username, organizationId } });
    if (userUsernameExists) {
        throw new Error("El nombre de usuario ya está en uso.");
    }
    const userSlug = slug(username);
    const userSlugExists = await prisma.user.findFirst({ where: { slug: userSlug, organizationId } });
    if (userSlugExists) {
        throw new Error("El nombre de usuario ya está en uso.");
    }
    const hashedPassword = await Bun.password.hash(password);
    const user = await prisma.user.create({
        data: {
            email,
            username,
            slug: userSlug,
            password: hashedPassword,
            organizationId,
        },
        select: {
            id: true,
            username: true,
        }
    });
    await prisma.member.create({
        data: {
            organizationId,
            userId: user.id,
            role: "user",
        }
    });
	return true;
};
