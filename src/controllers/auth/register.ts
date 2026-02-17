import slug from "slug";

import { prisma } from "../../models/prisma";
import { sendWelcomeAndVerifyEmail } from "../../services/email-notifications";


export const register = async (organizationId: number, email: string, username: string, password: string) => {
	// Verificar duplicados globalmente (sin organizationId)
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
    
    // Crear el usuario sin organizationId
    const newUser = await prisma.user.create({
        data: {
            email,
            username,
            slug: userSlug,
            password: hashedPassword,
        },
        select: {
            id: true,
            username: true,
        }
    });
    
    // Crear registro de permisos por defecto para esta organización
    await prisma.permission.create({
        data: {
            userId: newUser.id,
            organizationId,
            role: "user",
            hierarchyLevel: 0,
            // Todos los permisos por defecto en false
        },
    });
    
	// Create verification token and send combined welcome + verification email (fire-and-forget)
	const verificationToken = crypto.randomUUID();
	prisma.emailVerificationToken.create({
		data: {
			userId: newUser.id,
			token: verificationToken,
			expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
		},
	}).then(() => {
		sendWelcomeAndVerifyEmail(newUser.id, email, username, verificationToken).catch(console.error);
	}).catch(console.error);

	return true;
};
