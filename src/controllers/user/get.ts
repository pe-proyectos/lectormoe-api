import { prisma } from "../../models/prisma";

export const getUserById = async (organizationId: number | null, userId: number) => {
	// Si organizationId es null, solo verificar que el usuario exista
	if (organizationId === null) {
		const user = await prisma.user.findUnique({
			where: {
				id: userId,
			},
		});
		return user;
	}

	// Verificar que el usuario tenga permisos para esta organización
	const permission = await prisma.permission.findUnique({
		where: {
			userId_organizationId: {
				userId,
				organizationId,
			},
		},
	});

	if (!permission) {
		return null;
	}

	const user = await prisma.user.findUnique({
		where: {
			id: userId,
		},
	});

	if (!user) {
		return null;
	}

	return user;
};
