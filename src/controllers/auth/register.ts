import slug from "slug";

import { prisma } from "../../models/prisma";


export const register = async (email: string, username: string, password: string) => {
	const userEmailExists = await prisma.user.findFirst({ where: { email } });
	if (userEmailExists) {
		throw new Error("El correo ya está en uso.");
    }
    const userUsernameExists = await prisma.user.findFirst({ where: { username } });
    if (userUsernameExists) {
        throw new Error("El nombre de usuario ya está en uso.");
    }
    const userSlug = slug(username);
    const userSlugExists = await prisma.user.findFirst({ where: { slug: userSlug } });
    if (userSlugExists) {
        throw new Error("El nombre de usuario ya está en uso.");
    }
    const hashedPassword = await Bun.password.hash(password);
    await prisma.user.create({
        data: {
            email,
            username,
            slug: userSlug,
            password: hashedPassword,
        },
        select: {
            username: true,
        }
    });
	return true;
};
